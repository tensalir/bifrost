"use strict";
/**
 * Bifrost Figma plugin entry.
 * Command: Sync queued briefings for current monthly file.
 */
async function runSyncQueuedBriefings() {
    const fileKey = figma.fileKey;
    if (!fileKey) {
        throw new Error('No file key (save the file first or open from cloud).');
    }
    const BIFROST_API = 'http://localhost:3846';
    const res = await fetch(`${BIFROST_API}/api/jobs/queued?fileKey=${encodeURIComponent(fileKey)}`);
    if (!res.ok) {
        throw new Error(`Bifrost API error: ${res.status}`);
    }
    const data = (await res.json());
    const jobs = data.jobs ?? [];
    if (jobs.length === 0) {
        return { done: 0, failed: [] };
    }
    const TEMPLATE_PAGE_NAMES = ['Briefing Template to Duplicate', 'Briefing Template', 'Template'];
    const root = figma.root;
    const rootAny = root;
    if (typeof rootAny.loadAsync === 'function')
        await rootAny.loadAsync();
    const children = root.children ?? [];
    let templatePage = null;
    for (const node of children) {
        if (node.type !== 'PAGE')
            continue;
        const name = node.name;
        if (TEMPLATE_PAGE_NAMES.some((t) => name.includes(t) || name === t)) {
            templatePage = node;
            break;
        }
    }
    if (!templatePage) {
        throw new Error(`No template page found. Add a page named one of: ${TEMPLATE_PAGE_NAMES.join(', ')}`);
    }
    /**
     * Find the insertion index for a new experiment page under its section divider.
     * Section dividers are empty pages whose names match the sectionName.
     * Returns the index after the last page in that section (before the next section divider
     * or at the end of the page list). Returns -1 if no matching section found.
     *
     * Logic:
     * 1. Walk figma.root.children to find all section dividers (pages that don't start with "EXP-"
     *    and aren't template/utility pages).
     * 2. Find the divider whose name matches sectionName (case-insensitive, includes partial).
     * 3. The insertion point is right before the next section divider (or end of list).
     */
    function findSectionInsertionIndex(sectionName, allPages) {
        const UTILITY_PREFIXES = ['Briefing Template', 'Template', 'Cover', 'Status', 'Safe Zone', 'Export'];
        const upper = sectionName.toUpperCase().trim();
        // Identify section divider indices
        const dividers = [];
        for (let i = 0; i < allPages.length; i++) {
            const page = allPages[i];
            const name = page.name.trim();
            // Skip experiment pages and utility/template pages
            if (name.toUpperCase().startsWith('EXP-'))
                continue;
            if (UTILITY_PREFIXES.some((p) => name.includes(p)))
                continue;
            // Also skip page dividers with just dashes/spaces
            if (/^[-—–\s*]+$/.test(name))
                continue;
            dividers.push({ index: i, name: name.toUpperCase() });
        }
        // Find matching divider
        const matchIdx = dividers.findIndex((d) => d.name === upper || d.name.includes(upper) || upper.includes(d.name));
        if (matchIdx === -1)
            return -1;
        const divider = dividers[matchIdx];
        // Insertion point: just before the next section divider, or at end of pages
        const nextDivider = dividers[matchIdx + 1];
        if (nextDivider) {
            return nextDivider.index; // insert before the next section divider
        }
        return allPages.length; // append at end (after all pages in the last section)
    }
    function getPlaceholderValue(placeholderId, briefing) {
        const v = briefing.variants ?? [];
        const map = {
            'bifrost:exp_name': briefing.experimentName ?? '',
            'bifrost:idea': briefing.idea ?? '',
            'bifrost:audience_region': briefing.audienceRegion ?? '',
            'bifrost:segment': briefing.segment ?? '',
            'bifrost:formats': briefing.formats ?? '',
            'bifrost:var_a_headline': v[0]?.headline ?? '',
            'bifrost:var_a_subline': v[0]?.subline ?? '',
            'bifrost:var_a_cta': v[0]?.cta ?? '',
            'bifrost:var_b_headline': v[1]?.headline ?? '',
            'bifrost:var_b_subline': v[1]?.subline ?? '',
            'bifrost:var_b_cta': v[1]?.cta ?? '',
            'bifrost:var_c_headline': v[2]?.headline ?? '',
            'bifrost:var_c_subline': v[2]?.subline ?? '',
            'bifrost:var_c_cta': v[2]?.cta ?? '',
            'bifrost:var_d_headline': v[3]?.headline ?? '',
            'bifrost:var_d_subline': v[3]?.subline ?? '',
            'bifrost:var_d_cta': v[3]?.cta ?? '',
        };
        return map[placeholderId] ?? '';
    }
    function fillTextNodes(node, briefing) {
        if (node.type === 'TEXT') {
            const textNode = node;
            const bifrostId = textNode.getPluginData?.('bifrostId') || textNode.getPluginData?.('placeholderId');
            if (bifrostId) {
                const value = getPlaceholderValue(bifrostId, briefing);
                try {
                    textNode.characters = value;
                    textNode.textAutoResize = 'HEIGHT';
                }
                catch (_) { }
            }
            return;
        }
        const withChildren = node;
        if (withChildren.children?.length) {
            for (const child of withChildren.children) {
                fillTextNodes(child, briefing);
            }
        }
    }
    const failed = [];
    let done = 0;
    for (const job of jobs) {
        try {
            const briefing = job.briefingPayload;
            const cloned = templatePage.clone();
            cloned.name = job.experimentPageName;
            cloned.setPluginData('bifrostIdempotencyKey', job.idempotencyKey);
            cloned.setPluginData('bifrostMondayItemId', job.mondayItemId ?? '');
            if (briefing.sectionName) {
                cloned.setPluginData('bifrostSectionName', briefing.sectionName);
            }
            // Move cloned page to correct position under its section divider
            if (briefing.sectionName) {
                const allPages = root.children.filter((c) => c.type === 'PAGE');
                const insertAt = findSectionInsertionIndex(briefing.sectionName, allPages);
                if (insertAt >= 0 && insertAt < root.children.length) {
                    root.insertChild(insertAt, cloned);
                }
                // If insertAt === -1 or >= length, cloned stays where clone() put it (end)
            }
            fillTextNodes(cloned, briefing);
            const pageId = cloned.id;
            const fileUrl = `https://www.figma.com/file/${fileKey}?node-id=${encodeURIComponent(pageId.replace(':', '-'))}`;
            const completeRes = await fetch(`${BIFROST_API}/api/jobs/complete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    idempotencyKey: job.idempotencyKey,
                    figmaPageId: pageId,
                    figmaFileUrl: fileUrl,
                }),
            });
            if (!completeRes.ok) {
                failed.push(job.experimentPageName);
                continue;
            }
            done++;
        }
        catch (e) {
            failed.push(job.experimentPageName);
            try {
                await fetch(`${BIFROST_API}/api/jobs/fail`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        idempotencyKey: job.idempotencyKey,
                        errorCode: e instanceof Error ? e.message : 'Unknown',
                    }),
                });
            }
            catch (_) { }
        }
    }
    return { done, failed };
}
// UI is loaded from ui.html when built; inline fallback for dev
const pluginUiHtml = '<html><head><style>body{font-family:Inter,sans-serif;padding:12px;margin:0;}h3{margin:0 0 8px 0;font-size:12px;}button{padding:8px 16px;background:#0d99ff;color:#fff;border:none;border-radius:6px;cursor:pointer;width:100%;}#msg{font-size:11px;color:#666;margin-top:8px;}.err{color:#f24822;}</style></head><body><h3>Bifrost Sync</h3><p id="msg">Sync queued briefings from Monday into this file.</p><button id="sync">Sync queued briefings</button><script>document.getElementById("sync").onclick=()=>{parent.postMessage({pluginMessage:"sync"},"*");document.getElementById("msg").textContent="Syncing…";};onmessage=(e)=>{const d=e.data;const el=document.getElementById("msg");if(d.type==="result"){el.textContent="Done: "+d.done+" page(s). "+(d.failed&&d.failed.length?"Failed: "+d.failed.join(", "):"");el.className=d.failed&&d.failed.length?"err":"";}else if(d.type==="error"){el.textContent=d.message||"Error";el.className="err";}};</script></body></html>';
figma.showUI(pluginUiHtml, { width: 320, height: 200 });
figma.ui.onmessage = async (msg) => {
    if (msg === 'sync') {
        try {
            const result = await runSyncQueuedBriefings();
            figma.ui.postMessage({
                type: 'result',
                done: result.done,
                failed: result.failed,
            });
        }
        catch (e) {
            figma.ui.postMessage({
                type: 'error',
                message: e instanceof Error ? e.message : 'Sync failed',
            });
        }
    }
};
