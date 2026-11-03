"use client";

import { useRef, useEffect } from "react";
import {
  MDXEditor,
  MDXEditorMethods,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  markdownShortcutPlugin,
  toolbarPlugin,
  BoldItalicUnderlineToggles,
  ListsToggle,
  UndoRedo,
  BlockTypeSelect,
  linkPlugin,
  linkDialogPlugin,
} from "@mdxeditor/editor";
import "@mdxeditor/editor/style.css";

// ============================================================
// WysiwygEditor — wrapper for @mdxeditor/editor.
// Outputs markdown (rendered with react-markdown in ProductDetailDialog).
// ============================================================

interface WysiwygEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function WysiwygEditor({
  value,
  onChange,
  placeholder = "Tulis deskripsi panjang produk di sini...",
  className,
}: WysiwygEditorProps) {
  const ref = useRef<MDXEditorMethods>(null);

  // Sync external value changes (e.g., when loading from API)
  useEffect(() => {
    if (ref.current && value !== ref.current.getMarkdown()) {
      ref.current.setMarkdown(value || "");
    }
  }, [value]);

  return (
    <div className={`rounded-lg border border-input overflow-hidden ${className || ""}`}>
      <MDXEditor
        ref={ref}
        markdown={value || ""}
        onChange={onChange}
        placeholder={placeholder}
        plugins={[
          headingsPlugin(),
          listsPlugin(),
          quotePlugin(),
          thematicBreakPlugin(),
          linkPlugin(),
          linkDialogPlugin(),
          markdownShortcutPlugin(),
          toolbarPlugin({
            toolbarContents: () => (
              <>
                <UndoRedo />
                <BlockTypeSelect />
                <BoldItalicUnderlineToggles />
                <ListsToggle />
              </>
            ),
          }),
        ]}
        contentEditableClassName="prose prose-sm max-w-none min-h-[120px] p-3 focus:outline-none"
      />
    </div>
  );
}
