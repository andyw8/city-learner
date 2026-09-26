export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  Object.assign(node, props)
  node.append(...children)
  return node
}

export function statTile(label: string, value: number | string): HTMLElement {
  return el('div', { className: 'stat' }, [
    el('span', { className: 'stat-value', textContent: String(value) }),
    el('span', { className: 'stat-label', textContent: label }),
  ])
}
