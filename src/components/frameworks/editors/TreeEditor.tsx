'use client';

import { useState } from 'react';
import type { ToolDefinition, TreeNode } from '@/lib/tools/schema';

type TreeDefinition = Extract<ToolDefinition, { primitive: 'tree' }>;

export function TreeEditor({
  definition: _definition,
  data,
  onUpdate,
}: {
  definition: TreeDefinition;
  data: unknown;
  onUpdate: (data: unknown) => void;
}) {
  const root = (data as { root?: TreeNode })?.root || {
    id: 'root',
    label: 'Session / Elder Board',
    values: { personName: 'Session / Elder Board', roleTitle: 'Governing Authority' },
    children: [],
  };

  function addChild(parentId: string, personName: string, roleTitle: string, ministryArea: string) {
    if (!roleTitle.trim()) return;

    const newNode: TreeNode = {
      id: `node-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      label: `${roleTitle.trim()} (${personName.trim() || 'Open Role'})`,
      values: { personName: personName.trim(), roleTitle: roleTitle.trim(), ministryArea },
      children: [],
    };

    function appendNode(curr: TreeNode): TreeNode {
      if (curr.id === parentId) {
        return { ...curr, children: [...(curr.children || []), newNode] };
      }
      return {
        ...curr,
        children: (curr.children || []).map(appendNode),
      };
    }

    const updatedRoot = appendNode(root);
    onUpdate({ root: updatedRoot });
  }

  function removeNode(nodeId: string) {
    if (nodeId === 'root') return;

    function filterNode(curr: TreeNode): TreeNode {
      return {
        ...curr,
        children: (curr.children || []).filter((c) => c.id !== nodeId).map(filterNode),
      };
    }

    const updatedRoot = filterNode(root);
    onUpdate({ root: updatedRoot });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <h3 className="font-bold text-slate-900 dark:text-white text-sm mb-4">Hierarchical Organization Tree</h3>
        <TreeNodeItem node={root} onAddChild={addChild} onRemoveNode={removeNode} isRoot />
      </div>
    </div>
  );
}

function TreeNodeItem({
  node,
  onAddChild,
  onRemoveNode,
  isRoot = false,
}: {
  node: TreeNode;
  onAddChild: (parentId: string, personName: string, roleTitle: string, ministryArea: string) => void;
  onRemoveNode: (nodeId: string) => void;
  isRoot?: boolean;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [roleTitle, setRoleTitle] = useState('');
  const [personName, setPersonName] = useState('');
  const [ministryArea, setMinistryArea] = useState('General');

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!roleTitle.trim()) return;
    onAddChild(node.id, personName, roleTitle, ministryArea);
    setRoleTitle('');
    setPersonName('');
    setShowAdd(false);
  }

  return (
    <div className="ml-4 border-l-2 border-slate-200 pl-4 my-2 dark:border-slate-700">
      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-xs dark:border-slate-800 dark:bg-slate-800/60">
        <div>
          <h4 className="font-bold text-slate-900 dark:text-white">
            {node.values.roleTitle || node.label}
          </h4>
          {node.values.personName && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Assigned: <span className="font-medium text-slate-700 dark:text-slate-200">{node.values.personName}</span>
            </p>
          )}
          {node.values.ministryArea && (
            <span className="mt-1 inline-block rounded bg-white px-1.5 py-0.5 text-[9px] font-semibold text-slate-500 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
              {node.values.ministryArea}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 print:hidden">
          <button
            type="button"
            onClick={() => setShowAdd(!showAdd)}
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            {showAdd ? 'Cancel' : '+ Add Child'}
          </button>
          {!isRoot && (
            <button
              type="button"
              onClick={() => onRemoveNode(node.id)}
              className="text-slate-400 hover:text-rose-600 px-1 py-1"
              title="Delete node and children"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="mt-2 flex flex-wrap gap-2 items-end rounded-lg bg-white p-3 border border-indigo-200 shadow-xs dark:border-slate-700 dark:bg-slate-800 print:hidden">
          <div>
            <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-300">Role / Node Title</label>
            <input
              type="text"
              placeholder="e.g. Nursery Coordinator"
              value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
              className="rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-700 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-300">Person Name</label>
            <input
              type="text"
              placeholder="e.g. Jane Doe"
              value={personName}
              onChange={(e) => setPersonName(e.target.value)}
              className="rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-700 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-300">Ministry Area</label>
            <input
              type="text"
              placeholder="e.g. Family Ministry"
              value={ministryArea}
              onChange={(e) => setMinistryArea(e.target.value)}
              className="rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-700 dark:text-white"
            />
          </div>
          <button
            type="submit"
            className="rounded bg-slate-900 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
          >
            Add Node
          </button>
        </form>
      )}

      {node.children && node.children.length > 0 && (
        <div className="space-y-1">
          {node.children.map((child) => (
            <TreeNodeItem
              key={child.id}
              node={child}
              onAddChild={onAddChild}
              onRemoveNode={onRemoveNode}
            />
          ))}
        </div>
      )}
    </div>
  );
}
