export interface TreeNode<T> {
  label: string;
  fullPath: string;
  item?: T;
  children: TreeNode<T>[];
}

export function buildTree<T>(
  items: T[],
  getKey: (item: T) => string,
): TreeNode<T>[] {
  const root: TreeNode<T>[] = [];

  for (const item of items) {
    const segments = getKey(item).split("/");
    let current = root;
    let pathSoFar = "";

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      pathSoFar = pathSoFar ? `${pathSoFar}/${seg}` : seg;
      const isLeaf = i === segments.length - 1;

      let node = current.find((n) => n.label === seg);
      if (!node) {
        node = { label: seg, fullPath: pathSoFar, children: [] };
        current.push(node);
      }
      if (isLeaf) {
        node.item = item;
      }
      current = node.children;
    }
  }

  return root;
}
