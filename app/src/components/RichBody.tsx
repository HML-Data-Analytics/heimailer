import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { useCampaign } from "../state/campaign";
import { ImageIcon } from "./icons";

const PLACEHOLDERS = ["{{Name}}", "{{Company}}"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

type Corner = "nw" | "ne" | "sw" | "se";
interface Box {
  l: number;
  t: number;
  w: number;
  h: number;
}

/**
 * Rich message editor (contentEditable). Accepts typed text, {{placeholders}},
 * and pasted / dropped images / screenshots embedded inline as data URLs.
 *
 * Inserted images are selectable and **resizable via drag handles**, like
 * Outlook. The body is stored as HTML in draft.body. The editor is uncontrolled
 * (innerHTML set imperatively) so the caret never jumps while typing.
 */
export default function RichBody() {
  const { draft, setDraft, notify } = useCampaign();
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const editorRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [selImg, setSelImg] = useState<HTMLImageElement | null>(null);
  const [box, setBox] = useState<Box | null>(null);

  // Sync external changes (template load) without disturbing the caret.
  useEffect(() => {
    const el = editorRef.current;
    if (el && el.innerHTML !== draft.body) {
      el.innerHTML = draft.body;
      setSelImg(null);
    }
  }, [draft.body]);

  const commit = useCallback(() => {
    const el = editorRef.current;
    if (el) setDraft({ ...draftRef.current, body: el.innerHTML });
  }, [setDraft]);

  // Position the selection overlay over the selected image.
  const reposition = useCallback(() => {
    const img = selImg;
    const wrap = wrapRef.current;
    if (!img || !wrap || !wrap.contains(img)) {
      setBox(null);
      return;
    }
    const ir = img.getBoundingClientRect();
    const wr = wrap.getBoundingClientRect();
    setBox({ l: ir.left - wr.left, t: ir.top - wr.top, w: ir.width, h: ir.height });
  }, [selImg]);

  useEffect(() => {
    reposition();
    if (!selImg) return;
    const el = editorRef.current;
    const onMove = () => reposition();
    el?.addEventListener("scroll", onMove);
    window.addEventListener("resize", onMove);
    return () => {
      el?.removeEventListener("scroll", onMove);
      window.removeEventListener("resize", onMove);
    };
  }, [selImg, reposition]);

  function insertNodeAtCaret(node: Node) {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && el.contains(sel.anchorNode)) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(node);
      range.setStartAfter(node);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      el.appendChild(node);
    }
    commit();
  }

  function insertImageFile(file: File) {
    if (!file.type.startsWith("image/")) return;
    if (file.size > MAX_IMAGE_BYTES) {
      notify("error", "Image too large", `${file.name || "Image"} exceeds the 5 MB limit.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = document.createElement("img");
      img.src = String(reader.result);
      img.alt = file.name || "image";
      insertNodeAtCaret(img);
    };
    reader.readAsDataURL(file);
  }

  function onPaste(e: ClipboardEvent<HTMLDivElement>) {
    const items = e.clipboardData?.items;
    if (items) {
      for (const it of items) {
        if (it.kind === "file" && it.type.startsWith("image/")) {
          e.preventDefault();
          const file = it.getAsFile();
          if (file) insertImageFile(file);
          return;
        }
      }
    }
    const text = e.clipboardData.getData("text/plain");
    if (text) {
      e.preventDefault();
      insertNodeAtCaret(document.createTextNode(text));
    }
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    const files = e.dataTransfer?.files;
    if (files && files.length > 0 && files[0].type.startsWith("image/")) {
      e.preventDefault();
      Array.from(files).forEach(insertImageFile);
    }
  }

  function onEditorClick(e: ReactMouseEvent<HTMLDivElement>) {
    const t = e.target as HTMLElement;
    setSelImg(t.tagName === "IMG" ? (t as HTMLImageElement) : null);
  }

  function startResize(e: ReactMouseEvent, corner: Corner) {
    e.preventDefault();
    e.stopPropagation();
    const img = selImg;
    const editor = editorRef.current;
    if (!img || !editor) return;
    const startX = e.clientX;
    const startW = img.getBoundingClientRect().width;
    const maxW = editor.clientWidth - 24;
    const fromLeft = corner === "nw" || corner === "sw";

    function onMove(ev: MouseEvent) {
      const dx = ev.clientX - startX;
      let w = fromLeft ? startW - dx : startW + dx;
      w = Math.max(40, Math.min(w, maxW));
      img!.style.width = `${Math.round(w)}px`;
      img!.style.height = "auto";
      reposition();
    }
    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      commit();
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  function insertToken(token: string) {
    insertNodeAtCaret(document.createTextNode(token));
  }

  function pickImage() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      if (input.files?.[0]) insertImageFile(input.files[0]);
    };
    input.click();
  }

  return (
    <div className="field">
      <label className="label">
        Message <span className="req">*</span>
      </label>

      <div className="rich-wrap" ref={wrapRef}>
        <div
          ref={editorRef}
          className="rich-body"
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          data-placeholder="Dear {{Name}}, we would be delighted to welcome you…"
          onInput={commit}
          onPaste={onPaste}
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={onEditorClick}
          onKeyDown={() => selImg && setSelImg(null)}
        />

        {box && (
          <div className="img-resizer" style={{ left: box.l, top: box.t, width: box.w, height: box.h }}>
            {(["nw", "ne", "sw", "se"] as Corner[]).map((c) => (
              <span
                key={c}
                className={`img-handle img-handle--${c}`}
                onMouseDown={(e) => startResize(e, c)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="chips">
        {PLACEHOLDERS.map((p) => (
          <button
            key={p}
            type="button"
            className="chip"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => insertToken(p)}
            title={`Insert ${p}`}
          >
            {p}
          </button>
        ))}
        <button
          type="button"
          className="chip chip--image"
          onMouseDown={(e) => e.preventDefault()}
          onClick={pickImage}
          title="Insert an image"
        >
          <ImageIcon size={13} /> Image
        </button>
      </div>
      <p className="chips__hint">
        Click a tag to personalize, or <b>paste / drop an image</b> (screenshots work too). Click an
        image to resize it.
      </p>
    </div>
  );
}
