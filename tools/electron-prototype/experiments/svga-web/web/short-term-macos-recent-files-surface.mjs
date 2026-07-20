import {
  clearRecentSvgaFiles,
  getRecentSvgaFiles
} from "./short-term-macos-host-client.mjs";
import { visibleLaunchRecentRecords } from "./short-term-macos-recent-files-model.mjs";
import {
  renderLaunchRecentFiles,
  renderRecentFilesUnavailable
} from "./short-term-macos-launch-renderers.mjs";

function recentFileNodes(nodes) {
  return {
    listNode: nodes.recentList,
    noteNode: nodes.recentNote,
    clearButton: nodes.clearRecentButton
  };
}

export async function refreshShortTermRecentFiles({ bridge, nodes }) {
  const result = await getRecentSvgaFiles(bridge);
  const targetNodes = recentFileNodes(nodes);
  if (!result.available) {
    renderRecentFilesUnavailable(targetNodes);
    return;
  }
  renderLaunchRecentFiles(targetNodes, visibleLaunchRecentRecords(result.value));
}

export async function clearShortTermRecentFiles({ bridge, nodes }) {
  await clearRecentSvgaFiles(bridge);
  await refreshShortTermRecentFiles({ bridge, nodes });
}
