import type { Root } from "hast";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import type { ReactElement } from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";

/** Renders a converted Google Doc; the page around it supplies the styling. */
export function DocBody({ tree }: { tree: Root }): ReactElement {
  return toJsxRuntime(tree, { Fragment, jsx, jsxs });
}
