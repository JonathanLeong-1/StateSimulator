// dashboard/public/graph.js
// Pure SVG renderer for the agent spawn tree.
// Top-down hierarchical layout with status-colored nodes.

'use strict';

const GRAPH_CONFIG = {
  nodeWidth: 180,
  nodeHeight: 56,
  nodeRadius: 10,
  horizontalGap: 30,
  verticalGap: 70,
  padding: 40,
  statusColors: {
    active: '#4ec9b0',
    completed: '#608b4e',
    error: '#f44747',
    idle: '#6a6a6a',
  },
  workstreamColors: {
    backend: '#4a9eff',
    frontend: '#4aff8a',
    infra: '#ffaa4a',
    default: '#aaaaaa',
  },
  agentIcons: {
    'architect': '\u{1F3D7}',
    'backend-lead': '\u2699',
    'frontend-lead': '\u{1F3A8}',
    'infra-lead': '\u{1F527}',
    'developer': '\u{1F4BB}',
    'tester': '\u{1F9EA}',
    'code-reviewer': '\u{1F50D}',
    'docs-writer': '\u{1F4DD}',
  },
};

function buildTree(nodes, edges) {
  const children = new Map();
  const hasParent = new Set();

  for (const edge of edges) {
    if (!children.has(edge.from)) children.set(edge.from, []);
    children.get(edge.from).push(edge.to);
    hasParent.add(edge.to);
  }

  // Roots are nodes with no parent
  const roots = nodes.filter((n) => !hasParent.has(n.id)).map((n) => n.id);
  if (roots.length === 0 && nodes.length > 0) {
    roots.push(nodes[0].id);
  }

  return { children, roots };
}

function computeLayout(nodes, edges) {
  const { children, roots } = buildTree(nodes, edges);
  const positions = new Map();
  const levels = new Map();

  // BFS to assign levels
  const queue = roots.map((r) => ({ id: r, level: 0 }));
  const visited = new Set();

  while (queue.length > 0) {
    const { id, level } = queue.shift();
    if (visited.has(id)) continue;
    visited.add(id);
    if (!levels.has(level)) levels.set(level, []);
    levels.get(level).push(id);
    const kids = children.get(id) || [];
    for (const kid of kids) {
      if (!visited.has(kid)) {
        queue.push({ id: kid, level: level + 1 });
      }
    }
  }

  // Add any disconnected nodes
  for (const node of nodes) {
    if (!visited.has(node.id)) {
      const maxLevel = Math.max(0, ...levels.keys()) + 1;
      if (!levels.has(maxLevel)) levels.set(maxLevel, []);
      levels.get(maxLevel).push(node.id);
    }
  }

  // Compute positions
  const { nodeWidth, nodeHeight, horizontalGap, verticalGap, padding } = GRAPH_CONFIG;
  let maxWidth = 0;

  const sortedLevels = [...levels.keys()].sort((a, b) => a - b);
  for (const level of sortedLevels) {
    const nodesAtLevel = levels.get(level);
    const totalWidth = nodesAtLevel.length * nodeWidth + (nodesAtLevel.length - 1) * horizontalGap;
    maxWidth = Math.max(maxWidth, totalWidth);
  }

  for (const level of sortedLevels) {
    const nodesAtLevel = levels.get(level);
    const totalWidth = nodesAtLevel.length * nodeWidth + (nodesAtLevel.length - 1) * horizontalGap;
    const startX = padding + (maxWidth - totalWidth) / 2;
    const y = padding + level * (nodeHeight + verticalGap);

    for (let i = 0; i < nodesAtLevel.length; i++) {
      const x = startX + i * (nodeWidth + horizontalGap);
      positions.set(nodesAtLevel[i], { x, y });
    }
  }

  const svgWidth = maxWidth + padding * 2;
  const svgHeight = padding * 2 + (sortedLevels.length) * (nodeHeight + verticalGap);

  return { positions, svgWidth: Math.max(svgWidth, 300), svgHeight: Math.max(svgHeight, 150) };
}

function formatRunningTime(spawnedAt) {
  if (!spawnedAt) return '';
  const ms = Date.now() - new Date(spawnedAt).getTime();
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ${secs % 60}s`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderGraph(container, graphData, agents, workstreamFilter) {
  if (!container) return;

  const { nodes, edges } = graphData;
  if (!nodes || nodes.length === 0) {
    container.innerHTML = '<div class="empty-state">No agents spawned yet. The graph will appear when agents start working.</div>';
    return;
  }

  // Filter nodes by workstream if filter is active
  const filterActive = workstreamFilter && workstreamFilter.size > 0;
  const visibleNodeIds = new Set();

  for (const node of nodes) {
    const agent = agents ? (agents[node.id] || agents[node.label]) : null;
    const ws = agent ? agent.workstream : null;
    if (!filterActive || !ws || workstreamFilter.has(ws)) {
      visibleNodeIds.add(node.id);
    }
  }

  const visibleNodes = nodes.filter((n) => visibleNodeIds.has(n.id));
  const visibleEdges = edges.filter((e) => visibleNodeIds.has(e.from) && visibleNodeIds.has(e.to));

  if (visibleNodes.length === 0) {
    container.innerHTML = '<div class="empty-state">No agents match the selected workstream filter.</div>';
    return;
  }

  const { positions, svgWidth, svgHeight } = computeLayout(visibleNodes, visibleEdges);
  const { nodeWidth, nodeHeight, nodeRadius, statusColors, workstreamColors, agentIcons } = GRAPH_CONFIG;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" class="spawn-graph">`;

  // Defs for arrowhead
  svg += `<defs>
    <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="#555"/>
    </marker>
  </defs>`;

  // Draw edges
  for (const edge of visibleEdges) {
    const fromPos = positions.get(edge.from);
    const toPos = positions.get(edge.to);
    if (!fromPos || !toPos) continue;

    const x1 = fromPos.x + nodeWidth / 2;
    const y1 = fromPos.y + nodeHeight;
    const x2 = toPos.x + nodeWidth / 2;
    const y2 = toPos.y;
    const midY = (y1 + y2) / 2;

    svg += `<path d="M${x1},${y1} C${x1},${midY} ${x2},${midY} ${x2},${y2}" 
      fill="none" stroke="#555" stroke-width="1.5" marker-end="url(#arrowhead)" class="graph-edge"/>`;
  }

  // Draw nodes
  for (const node of visibleNodes) {
    const pos = positions.get(node.id);
    if (!pos) continue;

    const agent = agents ? (agents[node.id] || agents[node.label]) : null;
    const status = agent ? agent.status : 'idle';
    const color = statusColors[status] || statusColors.idle;
    const displayName = node.label || node.id;
    const icon = agentIcons[displayName] || agentIcons[node.id] || '\u{1F916}';
    const runTime = agent ? formatRunningTime(agent.spawnedAt) : '';
    const isActive = status === 'active';

    svg += `<g class="graph-node${isActive ? ' graph-node-active' : ''}" data-agent="${escapeXml(node.id)}" style="cursor:pointer">`;
    svg += `<rect x="${pos.x}" y="${pos.y}" width="${nodeWidth}" height="${nodeHeight}" 
      rx="${nodeRadius}" ry="${nodeRadius}" fill="#2d2d2d" stroke="${color}" stroke-width="2" class="graph-node-rect"/>`;

    // Status dot
    svg += `<circle cx="${pos.x + 14}" cy="${pos.y + 20}" r="5" fill="${color}" class="status-dot"/>`;

    // Icon + name
    svg += `<text x="${pos.x + 24}" y="${pos.y + 24}" fill="#e0e0e0" font-size="13" font-family="sans-serif">
      ${icon} ${escapeXml(displayName)}</text>`;

    // Running time
    if (runTime) {
      svg += `<text x="${pos.x + nodeWidth - 10}" y="${pos.y + 24}" fill="#9d9d9d" font-size="11" 
        font-family="sans-serif" text-anchor="end">${escapeXml(runTime)}</text>`;
    }

    // Current task (if any)
    if (agent && agent.currentTask) {
      const taskText = agent.currentTask.length > 25
        ? agent.currentTask.slice(0, 25) + '\u2026'
        : agent.currentTask;
      svg += `<text x="${pos.x + 14}" y="${pos.y + 44}" fill="#9d9d9d" font-size="10" 
        font-family="sans-serif">${escapeXml(taskText)}</text>`;
    }

    // Workstream badge
    const ws = agent ? agent.workstream : null;
    if (ws) {
      const wsColor = workstreamColors[ws] || workstreamColors.default;
      const wsLabel = escapeXml(ws);
      const badgeX = pos.x + nodeWidth - 10;
      const badgeY = pos.y + 44;
      const badgeWidth = ws.length * 6 + 10;
      svg += `<rect x="${badgeX - badgeWidth}" y="${badgeY - 9}" width="${badgeWidth}" height="14" 
        rx="3" ry="3" fill="${wsColor}" fill-opacity="0.2"/>`;
      svg += `<text x="${badgeX - badgeWidth / 2}" y="${badgeY}" fill="${wsColor}" font-size="9" 
        font-family="sans-serif" text-anchor="middle" font-weight="600">${wsLabel}</text>`;
    }

    svg += '</g>';
  }

  svg += '</svg>';
  container.innerHTML = svg;

  // Add click handlers
  const nodeElements = container.querySelectorAll('.graph-node');
  for (const el of nodeElements) {
    el.addEventListener('click', () => {
      const agentName = el.getAttribute('data-agent');
      container.dispatchEvent(new CustomEvent('agent-selected', {
        bubbles: true,
        detail: { agent: agentName },
      }));
    });
  }
}

// Export for use by app.js
if (typeof window !== 'undefined') {
  window.renderGraph = renderGraph;
  window.GRAPH_CONFIG = GRAPH_CONFIG;
}
