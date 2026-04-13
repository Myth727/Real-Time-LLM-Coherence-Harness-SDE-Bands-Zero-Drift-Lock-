# Document Intelligence Reference

**Universal knowledge seed for all AI models**
© 2026 Hudson & Perry Research · @RaccoonStampede · @Prosperous727

Source: dots.ocr / dots.mocr (RedNote HiLab, 2026) — state-of-the-art document parsing VLM.
Reference: arxiv.org/abs/2603.13032 · github.com/rednote-hilab/dots.ocr
Model: HuggingFace rednote-hilab/dots.mocr (3B parameters, SOTA on olmOCR-bench and OmniDocBench)

This document encodes everything an AI needs to intelligently process documents, images,
PDFs, tables, formulas, web pages, and scene text — either by calling dots.mocr directly
or by applying these principles when working with any vision-capable model.

---

## What This Covers

1. Eight document parsing task modes and their exact prompts
2. Complete document layout taxonomy (11 categories) with output format rules
3. Optimal inference parameters derived from production use
4. Image sizing constraints and the smart resize algorithm
5. Output cleaning rules — how VLMs fail on documents and how to recover
6. Format transformation rules (LaTeX, HTML, Markdown, base64)
7. Connection to ARCHITECT pinned document slots
8. Integration patterns for any vision-capable model

---

## Part 1 — Eight Parsing Task Modes

Each mode is a distinct task. Use the exact prompt string. The model switches behavior
by prompt alone — no architectural changes needed between tasks.

---

### Mode 1: Full Document Layout (`prompt_layout_all_en`)

**Use when:** Parsing any PDF, scanned document, or document image where you need the
complete structure — layout detection AND text extraction together.

**Exact prompt:**
```
Please output the layout information from the PDF image, including each layout element's
bbox, its category, and the corresponding text content within the bbox.

1. Bbox format: [x1, y1, x2, y2]

2. Layout Categories: The possible categories are ['Caption', 'Footnote', 'Formula',
'List-item', 'Page-footer', 'Page-header', 'Picture', 'Section-header', 'Table',
'Text', 'Title'].

3. Text Extraction & Formatting Rules:
    - Picture: For the 'Picture' category, the text field should be omitted.
    - Formula: Format its text as LaTeX.
    - Table: Format its text as HTML.
    - All Others (Text, Title, etc.): Format their text as Markdown.

4. Constraints:
    - The output text must be the original text from the image, with no translation.
    - All layout elements must be sorted according to human reading order.

5. Final Output: The entire output must be a single JSON object.
```

**Output format:** JSON array of layout objects.
**Example element:**
```json
{"bbox": [42, 88, 760, 112], "category": "Title", "text": "Document Title"}
{"bbox": [42, 130, 760, 480], "category": "Table", "text": "<table><tr><td>...</td></tr></table>"}
{"bbox": [42, 500, 380, 540], "category": "Formula", "text": "$$E = mc^2$$"}
```

---

### Mode 2: Layout Detection Only (`prompt_layout_only_en`)

**Use when:** You only need bounding boxes and category labels — no text extraction.
Faster, lower token usage.

**Exact prompt:**
```
Please output the layout information from this PDF image, including each layout's bbox
and its category. The bbox should be in the format [x1, y1, x2, y2]. The layout
categories for the PDF document include ['Caption', 'Footnote', 'Formula', 'List-item',
'Page-footer', 'Page-header', 'Picture', 'Section-header', 'Table', 'Text', 'Title'].
Do not output the corresponding text. The layout result should be in JSON format.
```

**Output format:** JSON array without `text` field.

---

### Mode 3: Pure OCR (`prompt_ocr`)

**Use when:** You just need the text content — no bounding boxes, no structure.
Equivalent to simple text extraction. Excludes Page-header and Page-footer.

**Exact prompt:**
```
Extract the text content from this image.
```

**Output format:** Plain text string.

---

### Mode 4: Grounding OCR (`prompt_grounding_ocr`)

**Use when:** You have a specific region of the document (a bounding box) and want
to extract only the text within that region.

**Exact prompt (append bbox coordinates):**
```
Extract text from the given bounding box on the image (format: [x1, y1, x2, y2]).
Bounding Box:
[x1, y1, x2, y2]
```

**Note:** Bbox coordinates must be scaled to match the model's resized input dimensions,
not the original image dimensions. See Part 5 for the resize algorithm.

---

### Mode 5: Web Page Parsing (`prompt_web_parsing`)

**Use when:** Input is a screenshot of a web page. Extracts layout structure in JSON.

**Exact prompt:**
```
Parsing the layout info of this webpage image with format json:
```

**Output format:** JSON with webpage layout elements.

---

### Mode 6: Scene Text Spotting (`prompt_scene_spotting`)

**Use when:** Input is a natural scene image (street signs, product labels, photos
with embedded text). Detects and recognizes all visible text.

**Exact prompt:**
```
Detect and recognize the text in the image.
```

**Output format:** Text string with detected text regions.

---

### Mode 7: Image to SVG (`prompt_image_to_svg`)

**Use when:** Converting charts, diagrams, logos, or structured graphics to SVG code.
The model produces renderable SVG that reconstructs the visual.

**Exact prompt (substitute actual dimensions):**
```
Please generate the SVG code based on the image.viewBox="0 0 {width} {height}"
```

**Output format:** SVG code string.
**Best model for this:** `dots.mocr-svg` (specialized variant, higher SVG accuracy).

---

### Mode 8: General QA (`prompt_general`)

**Use when:** Open-ended visual question answering on document content. No structured
output — model responds conversationally.

**Exact prompt:** Empty string (pass your question as the user message).

---

## Part 2 — Document Layout Taxonomy

11 categories. Every layout element in any document belongs to one of these.

| Category | Description | Output Format | Color (for visualization) |
|---|---|---|---|
| `Title` | Document or section main title | Markdown | Red |
| `Section-header` | Subsection headings | Markdown | Cyan |
| `Text` | Body text paragraphs | Markdown | Green |
| `List-item` | Bulleted or numbered list items | Markdown | Blue |
| `Caption` | Figure or table captions | Markdown | Orange |
| `Footnote` | Page footnotes | Markdown | Green |
| `Formula` | Mathematical expressions | **LaTeX** | Gray |
| `Table` | Tabular data | **HTML** | Pink |
| `Picture` | Images, figures, charts | **base64 crop** (text omitted) | Magenta |
| `Page-header` | Running header at top of page | Markdown | Green |
| `Page-footer` | Running footer at bottom of page | Markdown | Purple |

**Critical rules:**
- `Formula` → always LaTeX. Remove `\documentclass`, `\usepackage`, `\begin{document}` preamble. Wrap in `$$\n...\n$$`.
- `Table` → always HTML. Full `<table>` structure with `<tr>`, `<td>`, `<th>`.
- `Picture` → omit the `text` field entirely. Crop the image region and encode as base64 if needed.
- All elements must appear in **human reading order** (top-to-bottom, left-to-right, respecting column layout).

---

## Part 3 — Optimal Inference Parameters

These values are derived from production use and produce the best document parsing results.

| Parameter | Value | Why |
|---|---|---|
| `temperature` | `0.1` | Document parsing requires determinism. Low temperature prevents hallucination of text. |
| `top_p` | `0.9` (vLLM) / `1.0` (HF) | Standard nucleus sampling. |
| `max_completion_tokens` | `32768` (vLLM) / `24000` (HF) | Long documents produce long JSON. Never truncate mid-object. |
| `dpi` | `200` | Optimal balance of quality and processing speed for PDFs. 72 DPI if image > 4500px in any dimension. |
| `num_threads` | `64` | For multi-page PDFs. Each page processed in parallel. |

**For ARCHITECT's use case (single-document pinning):**
- Use `temperature=0.1` — you want exact text, not creative paraphrase
- Use `max_completion_tokens=16384` minimum — a single dense page can produce 8K+ tokens of JSON
- PDF at 200 DPI before sending to model

---

## Part 4 — Image Constraints and Smart Resize Algorithm

The model has hard pixel constraints. Images outside these bounds produce degraded results.

```
MIN_PIXELS = 3136    (56 × 56 minimum)
MAX_PIXELS = 11,289,600    (≈ 3360 × 3360 maximum)
IMAGE_FACTOR = 28    (all dimensions must be divisible by 28)
MAX_ASPECT_RATIO = 200    (max(h,w) / min(h,w) must be < 200)
```

**Smart resize algorithm** (must be applied before sending images):

1. Round height and width to nearest multiple of 28
2. If total pixels > MAX_PIXELS: scale down proportionally, maintaining 28-factor alignment
3. If total pixels < MIN_PIXELS: scale up proportionally, maintaining 28-factor alignment
4. Never distort aspect ratio beyond the rounding adjustments

**Why this matters for ARCHITECT pinned slots:**
When preprocessing a document image for the pinned slot system, apply smart resize
before sending to any vision model. Oversized images get silently truncated by most
APIs. Undersized images produce poor OCR accuracy.

**Practical sizing for common document types:**
- A4 at 200 DPI: 1654 × 2339 = 3.9M pixels — within bounds
- Letter at 300 DPI: 2550 × 3300 = 8.4M pixels — within bounds  
- Large poster at 600 DPI: may exceed MAX_PIXELS — must downscale first

---

## Part 5 — Output Cleaning Rules

VLMs produce imperfect JSON when parsing documents. These are the documented failure modes
and recovery strategies, derived from the `OutputCleaner` class in dots.ocr.

### Failure Mode 1: Incomplete JSON (most common)

**Symptom:** JSON array cut off mid-object — model hit token limit.

**Detection:** Output doesn't end with `]`. Or length > 50,000 characters.

**Recovery:**
1. Find the last `{"bbox":` occurrence
2. Truncate everything from that position back
3. Remove trailing comma if present
4. Close the array with `]`

**Rule:** Never try to complete the truncated object — you'll hallucinate coordinates.
Discard the incomplete last element. The preceding elements are reliable.

---

### Failure Mode 2: Missing Delimiters

**Symptom:** Two JSON objects appear adjacent with no comma: `}{`

**Detection:** Regex `\}\s*\{(?!")` matches this pattern.

**Recovery:** Replace `}{` with `},{` throughout.

---

### Failure Mode 3: Invalid Bbox (3 coordinates instead of 4)

**Symptom:** `"bbox": [x1, y1, x2]` — missing fourth coordinate.

**Recovery:** Keep `category` and `text` fields from that element, discard the `bbox`.
The text content is still valid even if the position is lost.

---

### Failure Mode 4: Duplicate Objects

**Symptom:** Same `{"bbox": ..., "category": ..., "text": ...}` object appears 5+ times.

**Cause:** Model looping on repeated content (headers, footers, watermarks).

**Recovery:** Keep first occurrence only. Remove all subsequent duplicates. Preserve reading order.

**Also check:** Duplicate bboxes with different text — indicates model re-detecting the same region.
Keep first occurrence.

---

### Failure Mode 5: JSON Parse Failure After Cleaning

**Fallback 1:** Use regex `\{[^{}]*?"bbox"\s*:\s*\[[^\]]*?\][^{}]*?\}` to extract
individual valid objects. Collect them into an array.

**Fallback 2:** If only one incomplete object, extract bbox coordinates, category,
and up to 10,000 characters of text individually using targeted regex.

---

### Validation Checklist Before Using Output

```
[ ] Is output a valid JSON array? → json.loads() without exception
[ ] Every object has "bbox" as [x1, y1, x2, y2] (4 numbers)? → x2 > x1, y2 > y1
[ ] Every object has "category" from the 11-item taxonomy?
[ ] Objects are in reading order (generally y1 increases down the page)?
[ ] No duplicate bboxes?
[ ] Tables formatted as HTML (starts with <table>)?
[ ] Formulas formatted as LaTeX (contains \\ or $)?
[ ] Picture objects have no "text" field?
```

---

## Part 6 — Format Transformation Rules

### LaTeX Formula Cleaning

Before storing or injecting formula text:

1. Remove preamble commands: `\documentclass{...}`, `\usepackage{...}`, `\begin{document}`, `\end{document}`
2. If already wrapped in `$$...$$` with no nested `$`: normalize to `$$\n{content}\n$$`
3. If wrapped in `\[...\]`: convert to `$$\n{content}\n$$`
4. If inline `$...$`: leave as-is
5. Remove backtick wrappers (`` `$...` `` → `$...$`)

### Table HTML

Tables come out as full HTML. When injecting into markdown or plain text:
- Strip `<table>`, use as-is for HTML contexts
- For plain text injection, convert `<td>` content to pipe-separated format: `| col1 | col2 |`
- Preserve `colspan` and `rowspan` information — important for complex financial and scientific tables

### Converting Layout JSON to Clean Markdown

Reading order is already correct. Concatenate text fields with double newlines:

```python
def layout_to_markdown(cells, skip_headers_footers=False):
    parts = []
    for cell in cells:
        if skip_headers_footers and cell['category'] in ['Page-header', 'Page-footer']:
            continue
        if cell['category'] == 'Picture':
            parts.append('![image](embedded)')  # or base64 if available
        elif cell['category'] == 'Formula':
            parts.append(clean_formula(cell['text']))
        else:
            parts.append(cell.get('text', '').strip())
    return '\n\n'.join(filter(None, parts))
```

For benchmark compatibility (OmniDocBench, olmOCR-bench), always skip Page-header
and Page-footer — these inflate edit distance scores artificially.

---

## Part 7 — Connection to ARCHITECT Pinned Document Slots

ARCHITECT's pinned document slots currently accept text files only (`readAsText()`).
They fail silently on PDFs and images. dots.mocr is the preprocessing layer that
unlocks these file types.

### File Type Detection Rules

| Extension | Direct text read | Needs VLM preprocessing |
|---|---|---|
| `.txt`, `.md`, `.csv`, `.json`, `.xml` | ✓ | — |
| `.py`, `.js`, `.ts`, `.html`, `.css` | ✓ | — |
| `.pdf` | ✗ | dots.mocr `prompt_layout_all_en` per page |
| `.jpg`, `.jpeg`, `.png` | ✗ | dots.mocr `prompt_layout_all_en` or `prompt_ocr` |
| `.docx`, `.xlsx`, `.pptx` | ✗ | Convert to PDF first, then dots.mocr |

### Preprocessing Pipeline for Binary Files

```
1. Detect file type by extension
2. If PDF: load at 200 DPI per page (fitz), send each page to dots.mocr
3. If image: apply smart_resize, send to dots.mocr
4. Collect JSON output per page
5. Run OutputCleaner on each page result
6. Convert each page to markdown via layout_to_markdown(skip_headers_footers=True)
7. Concatenate pages with page break markers
8. Truncate to 40KB (ARCHITECT's MAX_PINNED_CHARS)
9. Pin resulting text — AI now has full document context every turn
```

### Recommended Prompt Mode Per Document Type

| Document Type | Recommended Mode |
|---|---|
| Academic paper, report, contract | `prompt_layout_all_en` |
| Scanned document | `prompt_layout_all_en` |
| Screenshot, webpage | `prompt_web_parsing` |
| Scene photo with text | `prompt_scene_spotting` |
| Chart, diagram, logo | `prompt_image_to_svg` |
| Simple image with text | `prompt_ocr` |
| Known region of document | `prompt_grounding_ocr` |

---

## Part 8 — Integration with Any Vision-Capable Model

dots.mocr prompts work with any model that accepts image + text input. Behavior
varies by model capability.

### Using with GPT-4V / GPT-4o

```python
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{
        "role": "user",
        "content": [
            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}},
            {"type": "text", "text": PROMPT_LAYOUT_ALL_EN}
        ]
    }],
    temperature=0.1,
    max_tokens=16384
)
```

**GPT-4V notes:** Generally respects JSON output format. Table HTML quality is high.
Formula LaTeX quality is moderate — may need preamble cleaning.

### Using with Claude

```python
response = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=16384,
    messages=[{
        "role": "user",
        "content": [
            {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": base64_image}},
            {"type": "text", "text": PROMPT_LAYOUT_ALL_EN}
        ]
    }]
)
```

**Claude notes:** Strong at reading order. Excellent table HTML. May add explanatory
text before JSON — strip everything before the first `[`.

### Using with Gemini

```python
response = model.generate_content([image_part, PROMPT_LAYOUT_ALL_EN])
```

**Gemini notes:** Strong OCR accuracy. May use different bbox normalization — verify
coordinates are in pixel space, not 0-1 normalized floats.

### Universal Post-Processing

Regardless of model, always:

1. Strip markdown code fences: remove `` ```json `` and `` ``` `` wrappers
2. Strip explanatory text: find first `[` and last `]`, extract that substring
3. Run OutputCleaner — every model produces malformed JSON occasionally
4. Validate bbox coordinates: `x2 > x1` and `y2 > y1` for all elements
5. Scale coordinates back to original image dimensions if model resized input

---

## Part 9 — Performance Benchmarks (For Model Selection)

When choosing between models for document parsing tasks:

| Benchmark | dots.mocr | Gemini 2.5 Pro | Qwen3-VL-235B | Notes |
|---|---|---|---|---|
| OmniDocBench TextEdit↓ | **0.031** | 0.075 | 0.069 | Lower is better |
| OmniDocBench ReadOrder↓ | **0.029** | 0.097 | 0.068 | Lower is better |
| olmOCR-bench Overall | 83.9% | — | — | Higher is better |
| Tables (TEDS)↑ | 90.7% | — | — | HTML table quality |
| Elo Score Average | 1124.7 | **1210.7** | — | Gemini leads on Elo |

**Practical guidance:**
- For structured document parsing (PDFs, contracts, academic papers): dots.mocr is most cost-effective at 3B parameters
- For maximum accuracy on complex mixed documents: Gemini 2.5 Pro leads on Elo
- For SVG generation from charts/diagrams: `dots.mocr-svg` is specialized and leads all models
- For multilingual documents (Arabic, Tibetan, Kannada, Cyrillic, CJK): dots.mocr has explicit optimization

---

## Quick Reference Card

```
TASK                    PROMPT MODE               OUTPUT FORMAT
─────────────────────────────────────────────────────────────
Full layout + text      prompt_layout_all_en      JSON array
Layout boxes only       prompt_layout_only_en     JSON array (no text)
Plain text extract      prompt_ocr                String
Region extraction       prompt_grounding_ocr      String
Web page                prompt_web_parsing        JSON
Scene/photo text        prompt_scene_spotting     String
Chart → SVG             prompt_image_to_svg       SVG code
General QA              prompt_general            String

INFERENCE PARAMS        VALUE
─────────────────────
temperature             0.1
top_p                   0.9
max_tokens              16384–32768
dpi (PDF raster)        200

IMAGE CONSTRAINTS       VALUE
─────────────────────
min_pixels              3,136 (56×56)
max_pixels              11,289,600 (~3360×3360)
dimension_factor        28 (all dims divisible by 28)
max_aspect_ratio        200:1

LAYOUT CATEGORIES (11)
─────────────────────
Title, Section-header, Text, List-item, Caption, Footnote,
Formula (→LaTeX), Table (→HTML), Picture (→omit text),
Page-header, Page-footer

COMMON FAILURE MODES    RECOVERY
─────────────────────────────────────────────────────────────
Truncated JSON          Find last {"bbox": and cut before it
Missing commas          Replace }{ with },{
3-coord bbox            Keep text/category, drop bbox
5+ duplicate objects    Keep first, discard rest
Parse failure           Regex-extract individual objects
```

---

## Attribution and License

dots.ocr / dots.mocr is developed by RedNote HiLab (Xiaohongshu).
This knowledge seed is derived from the open-source repository and papers.
Cite as:

```
Zheng et al. (2026). Multimodal OCR: Parse Anything from Documents. arXiv:2603.13032
Li et al. (2025). dots.ocr: Multilingual Document Layout Parsing. arXiv:2512.02498
```

Model weights: huggingface.co/rednote-hilab/dots.mocr
License: dots.ocr LICENSE AGREEMENT (see repository)

---

*© 2026 Hudson & Perry Research — This knowledge seed compiled for ARCHITECT integration.*
*All prompt text © RedNote HiLab. Inference parameters and algorithms derived from open-source code.*

---

## Part 10 — Per-Mode Configuration Maps (Production-Derived)

These three maps are extracted directly from production demo code and encode hard-won
knowledge about how each mode behaves differently. Any implementation must use them.

### Map 1: Fitz Preprocessing Required Per Mode

```python
PROMPT_TO_FITZ_PREPROCESS = {
    "prompt_layout_all_en":  True,   # Document — needs DPI upsampling pipeline
    "prompt_layout_only_en": True,   # Document detection — needs DPI upsampling
    "prompt_ocr":            True,   # OCR — needs DPI upsampling
    "prompt_web_parsing":    False,  # Web screenshots — already screen resolution
    "prompt_scene_spotting": False,  # Scene photos — fitz degrades natural images
    "prompt_image_to_svg":   False,  # Charts/graphics — fitz artifacts hurt SVG
    "prompt_general":        False,  # QA — no preprocessing needed
}
```

**What fitz preprocessing does:** Converts image → PDF → re-rasters at 200 DPI.
Specifically designed for low-DPI scanned documents. Actively harmful for web
screenshots and scene photos which are already at screen resolution.

**Rule:** Always look up the mode before preprocessing. Never apply fitz universally.

---

### Map 2: Temperature Per Mode

```python
PROMPT_TO_TEMPERATURE = {
    "prompt_layout_all_en":  0.1,   # Deterministic — exact JSON required
    "prompt_layout_only_en": 0.1,   # Deterministic — exact JSON required
    "prompt_ocr":            0.1,   # Deterministic — exact text required
    "prompt_web_parsing":    0.1,   # Deterministic — structured output
    "prompt_scene_spotting": 0.1,   # Deterministic — exact text detection
    "prompt_image_to_svg":   0.9,   # Creative — SVG generation needs variation
    "prompt_general":        0.1,   # Default — can be overridden by user
}
```

**Critical:** The SVG mode exception is not a typo. SVG generation at temperature=0.1
produces rigid, repetitive SVG with poor coverage of complex graphical elements.
At temperature=0.9 the model explores more path options and produces better reconstructions.
Every other mode benefits from determinism.

**Do not use a single temperature for all modes.**

---

### Map 3: Model Routing Per Mode

```python
PROMPT_TO_MODEL = {
    "prompt_image_to_svg": "dots.mocr-svg",  # Specialized SVG model
    # All other modes → dots.mocr (default)
}
```

`dots.mocr-svg` is a specialized fine-tune. Sending SVG tasks to the base `dots.mocr`
produces significantly lower quality SVG. On the UniSVG benchmark, `dots.mocr-svg`
scores 0.902 overall vs `dots.mocr` at 0.894 — and on Chartmimic: 0.905 vs 0.772.

**Rule:** Before calling any model, check `PROMPT_TO_MODEL`. If the mode has an entry,
use that model. Otherwise use `dots.mocr`.

---

### Map 4: Filename-Based Auto-Routing (Smart Mode Selection)

When a filename is available, use keyword matching to auto-select the prompt mode:

```python
DEMO_CASE_CONFIG = {
    "doc":      {"prompt_mode": "prompt_layout_all_en"},
    "formula":  {"prompt_mode": "prompt_layout_all_en"},
    "table":    {"prompt_mode": "prompt_layout_all_en"},
    "detect":   {"prompt_mode": "prompt_layout_only_en"},
    "ocr":      {"prompt_mode": "prompt_ocr"},
    "webpage":  {"prompt_mode": "prompt_web_parsing"},
    "scene":    {"prompt_mode": "prompt_scene_spotting"},
    "svg":      {"prompt_mode": "prompt_image_to_svg"},
    "general_qa": {
        "prompt_mode": "prompt_general",
        "custom_prompt": "your question here"
    },
}
DEFAULT_DEMO_CONFIG = {"prompt_mode": "prompt_layout_all_en"}
```

**Matching logic:** Check if any keyword appears as a substring of the filename
(case-insensitive). First match wins. Fall back to `prompt_layout_all_en` if no match.

**For ARCHITECT pinned slots:** When user uploads a file, check the filename for these
keywords before calling the model. This avoids asking the user to select a mode manually.

---

## Part 11 — Critical Implementation Details

### The `filtered` Flag — Degraded Output Detection

When JSON parsing of the model output fails entirely, the parser falls back to
cleaned plain text. The result object includes `filtered: True` to signal this.

```python
result = {
    "layout_image": ...,
    "cells_data": None,        # JSON failed — no structured data
    "md_content": "raw text",  # Plain text fallback
    "filtered": True,          # SIGNAL: output is degraded
}
```

**What to do when `filtered=True`:**
- The text content may still be usable as plain OCR output
- Do NOT attempt to parse `md_content` as structured JSON
- Log or surface the degraded quality to the user
- For ARCHITECT pinned slots: use the text but prepend a warning comment

**What causes filtering:** Token limit exceeded mid-JSON, corrupted model output,
or OutputCleaner failing all recovery strategies.

---

### The `_nohf` Variant — Clean Output for Context Injection

The parser generates two markdown files per page:

| File | Contents | Use when |
|---|---|---|
| `filename.md` | Full content including Page-header and Page-footer | Human reading |
| `filename_nohf.md` | Content WITHOUT Page-header and Page-footer | Benchmarks, context injection |

**For ARCHITECT pinned document slots: always use `_nohf` variant.**

Page headers and footers are typically "Chapter 3", "Page 47", "Confidential — Draft",
"Company Name 2024" — noise that pollutes the context window and confuses coherence
scoring. Stripping them reduces pinned doc size by 5–15% and improves signal quality.

---

### Grounding OCR Bbox Coordinate Scaling

The `prompt_grounding_ocr` mode requires bbox coordinates — but these must be in the
**model's resized input space**, not the original image space.

**The scaling pipeline:**

```python
# 1. Get original image dimensions
orig_w, orig_h = original_image.size

# 2. Compute resized dimensions (what the model sees)
input_h, input_w = smart_resize(orig_h, orig_w, factor=28,
                                 min_pixels=3136, max_pixels=11289600)

# 3. Scale the user's bbox from original to model space
scale_x = input_w / orig_w
scale_y = input_h / orig_h
scaled_bbox = [
    int(user_bbox[0] * scale_x),
    int(user_bbox[1] * scale_y),
    int(user_bbox[2] * scale_x),
    int(user_bbox[3] * scale_y),
]

# 4. Pass scaled_bbox in the prompt
prompt = f"Extract text from the given bounding box: {scaled_bbox}"
```

**Without this scaling:** The model receives coordinates that don't correspond to
the actual region in its resized view. Results will be incorrect or empty.

**After getting results:** Scale bbox coordinates back from model space to original:
```python
# Inverse scaling to convert model output bboxes to original image space
orig_bbox = [
    int(model_bbox[0] / scale_x),
    int(model_bbox[1] / scale_y),
    int(model_bbox[2] / scale_x),
    int(model_bbox[3] / scale_y),
]
```

---

### Multi-Page PDF Threading Pattern

```python
# Correct multi-threaded PDF processing
tasks = [{"origin_image": img, "page_idx": i, ...}
         for i, img in enumerate(images)]

with ThreadPool(min(total_pages, 64)) as pool:
    results = list(pool.imap_unordered(_process_single_page, tasks))

# CRITICAL: imap_unordered returns pages out of order
results.sort(key=lambda x: x["page_no"])

# Join pages
combined_md = "\n\n---\n\n".join(
    r["md_content"] for r in results if r.get("md_content")
)
```

**Key points:**
- `imap_unordered` is faster than `imap` — results come back as pages finish
- Must sort by `page_no` after collection — never assume order
- Page separator is `\n\n---\n\n` — the `---` is a markdown horizontal rule marking page boundaries
- HuggingFace inference mode: force `num_thread=1` (no GPU parallelism)
- vLLM mode: up to 64 threads, capped at total page count

---

### Parser Instance Caching

Don't recreate parser instances for each request. Cache by model name:

```python
_parser_cache = {}

def get_parser(model_name, min_pixels=None, max_pixels=None):
    if model_name in _parser_cache:
        # Update settings on existing instance
        parser = _parser_cache[model_name]
        parser.min_pixels = min_pixels
        parser.max_pixels = max_pixels
        return parser
    # Create new instance
    parser = DotsOCRParser(model_name=model_name, ...)
    _parser_cache[model_name] = parser
    return parser
```

**Why this matters:** Creating a new parser instance for each request adds overhead.
For HuggingFace mode, it reloads model weights each time — catastrophic for latency.

---

### Custom Prompt (General QA Mode Only)

`prompt_general` is the only mode that accepts a user-defined prompt. All other
modes have locked template prompts that must not be overridden.

```python
# Correct: custom prompt only for prompt_general
if prompt_mode == "prompt_general":
    effective_prompt = custom_prompt or ""
else:
    effective_prompt = dict_promptmode_to_prompt[prompt_mode]
    # custom_prompt is IGNORED for all other modes
```

**Use cases for prompt_general:**
- "What is the title of this document?"
- "Describe the chart in panel 3"
- "What year was this document published?"
- "Across panels 1-12, which variable is most positively correlated with clean accuracy?"

Treat `prompt_general` as a VLM QA interface. Temperature can be raised (0.3–0.7)
for more conversational responses.

---

## Part 12 — Elo Evaluation Rubric (Full Scoring System)

Source: `tools/elo_score_prompt.py`. The complete rubric used to compare any two
OCR model outputs. Reusable for evaluating any document parsing system.

**Evaluation is conducted by a judge LLM** (Gemini Flash in production) comparing
two model outputs against the original image.

### What TO Score (Content Accuracy Only)

1. **Text accuracy:** Character-level recognition errors, missing words, hallucinated content
2. **Table accuracy:** Correctness of cell data, completeness, row/column alignment
3. **Formula accuracy:** Symbol preservation, completeness, semantic equivalence of math

### What to ABSOLUTELY IGNORE

- Markdown formatting differences (`#` vs `##`, `*` vs `-`)
- Layout, newlines, indentation, paragraph breaks
- Headers, footers, page numbers
- Table border styles (`|---|` vs `|:--|`)
- Equivalent LaTeX representations (`$x^2$` vs `$x \cdot x$`)
- **Image/figure processing differences (ABSOLUTELY IGNORE):**
  - Whether model outputs a figure bbox, describes the image, extracts embedded text, or skips it entirely — these are ALL equivalent. Never declare a winner based on image handling.

### Tie Criteria

Declare a **tie** when:
- Content is identical, format differs
- Table data identical, syntax differs
- Formulas are semantically equivalent
- Both models share the same minor errors
- Main text accurate but one model caught a footer the other didn't

**Rule: It is better to judge tie than to incorrectly declare a winner based on format.**

### Winner Criteria

Declare a winner ONLY when there is a significant difference in:
- Typos and character recognition errors
- Omissions of actual content
- Hallucinated content not in the original
- Table data errors
- Formula semantic errors (wrong mathematical meaning)

### Output Format

```json
{"winner": "1", "reason": "Model 1 correctly identified the formula as $E=mc^2$ while Model 2 omitted the superscript producing $Emc2$"}
{"winner": "2", "reason": "Model 2 correctly extracted all 5 table rows; Model 1 missed the last row entirely"}
{"winner": "tie", "reason": "Both models produced identical text content. Model 1 used HTML table syntax while Model 2 used pipe tables, but data is identical. Image regions ignored per evaluation protocol."}
```

**Evaluation is conducted by Gemini Flash** (not Gemini Pro) — faster and cheaper,
validated to produce consistent Elo scores matching human evaluation patterns.

---

## Updated Quick Reference Card

```
TASK                    MODE                      TEMP   FITZ   MODEL
──────────────────────────────────────────────────────────────────────
Full layout + text      prompt_layout_all_en      0.1    YES    dots.mocr
Layout boxes only       prompt_layout_only_en     0.1    YES    dots.mocr
Plain text              prompt_ocr                0.1    YES    dots.mocr
Region extraction       prompt_grounding_ocr      0.1    YES*   dots.mocr
Web page                prompt_web_parsing        0.1    NO     dots.mocr
Scene/photo text        prompt_scene_spotting     0.1    NO     dots.mocr
Chart/diagram → SVG     prompt_image_to_svg       0.9    NO     dots.mocr-svg
General QA              prompt_general            0.1    NO     dots.mocr

* grounding_ocr: apply pixel coordinate scaling before sending bbox

OUTPUT VARIANTS
──────────────────────────────────────────────────────────────────────
filename.md             Full output (includes Page-header/footer)
filename_nohf.md        Clean output (NO headers/footers) ← USE THIS
filename.json           Structured layout cells array
filename.jpg            Layout visualization with colored bboxes
filtered=True           JSON parse failed; md_content is plain text fallback

MULTI-PAGE PDF
──────────────────────────────────────────────────────────────────────
Separator between pages: \n\n---\n\n
Threading:              ThreadPool up to 64 (HF mode: 1)
Sort after:             Sort by page_no (imap_unordered loses order)

ELO EVALUATION
──────────────────────────────────────────────────────────────────────
Score only:             Text accuracy, table data, formula semantics
Ignore completely:      Formatting, layout, image handling, headers/footers
Tie when:               Same content, different format
Judge LLM:              Gemini Flash
Output:                 {"winner": "1"|"2"|"tie", "reason": "..."}
```

---

## Part 10 — Per-Mode Configuration Maps (Production-Derived)

These three maps are extracted directly from production demo code. Any implementation must use them.

### Map 1: Fitz Preprocessing Required Per Mode

```
PROMPT_TO_FITZ_PREPROCESS = {
    "prompt_layout_all_en":  True,   # Document — needs DPI upsampling
    "prompt_layout_only_en": True,   # Document detection — needs DPI upsampling
    "prompt_ocr":            True,   # OCR — needs DPI upsampling
    "prompt_web_parsing":    False,  # Web screenshots — already screen resolution
    "prompt_scene_spotting": False,  # Scene photos — fitz degrades natural images
    "prompt_image_to_svg":   False,  # Charts/graphics — fitz artifacts hurt SVG
    "prompt_general":        False,  # QA — no preprocessing needed
}
```

Fitz preprocessing converts image → PDF → re-rasters at 200 DPI. Designed for low-DPI
scanned documents. Actively harmful for web screenshots and scene photos.
Rule: Always look up the mode before preprocessing. Never apply fitz universally.

---

### Map 2: Temperature Per Mode

```
PROMPT_TO_TEMPERATURE = {
    "prompt_layout_all_en":  0.1,   # Deterministic — exact JSON required
    "prompt_layout_only_en": 0.1,
    "prompt_ocr":            0.1,
    "prompt_web_parsing":    0.1,
    "prompt_scene_spotting": 0.1,
    "prompt_image_to_svg":   0.9,   # EXCEPTION: SVG needs variation
    "prompt_general":        0.1,   # Default — can be user-overridden
}
```

The SVG exception is not a typo. SVG generation at temperature=0.1 produces rigid,
repetitive SVG with poor coverage of complex graphical elements. At 0.9 the model
explores more path options. Do not use a single temperature for all modes.

---

### Map 3: Model Routing Per Mode

```
PROMPT_TO_MODEL = {
    "prompt_image_to_svg": "dots.mocr-svg",  # Specialized SVG model
    # All other modes use dots.mocr (default)
}
```

dots.mocr-svg is a specialized fine-tune. On Chartmimic benchmark: 0.905 vs 0.772 for
the base model. On UniSVG: 0.902 vs 0.894. Always route SVG tasks to the SVG model.

---

### Map 4: Filename-Based Auto-Routing

```
DEMO_CASE_CONFIG = {
    "doc":      {"prompt_mode": "prompt_layout_all_en"},
    "formula":  {"prompt_mode": "prompt_layout_all_en"},
    "table":    {"prompt_mode": "prompt_layout_all_en"},
    "detect":   {"prompt_mode": "prompt_layout_only_en"},
    "ocr":      {"prompt_mode": "prompt_ocr"},
    "webpage":  {"prompt_mode": "prompt_web_parsing"},
    "scene":    {"prompt_mode": "prompt_scene_spotting"},
    "svg":      {"prompt_mode": "prompt_image_to_svg"},
}
DEFAULT_DEMO_CONFIG = {"prompt_mode": "prompt_layout_all_en"}
```

Matching: check if keyword is a case-insensitive substring of the filename. First match
wins. Fall back to prompt_layout_all_en if no match.
For ARCHITECT pinned slots: check filename keywords before calling any model.

---

## Part 11 — Critical Implementation Details

### The `filtered` Flag — Degraded Output Detection

When JSON parsing fails entirely, the parser falls back to cleaned plain text and sets
`filtered=True` in the result object.

What `filtered=True` means: cells_data is None, md_content is plain text, no structure.
What to do: still usable as raw OCR text. Do not try to parse it as JSON.
For ARCHITECT pinned slots: use the text but note the degraded quality.
What causes it: token limit exceeded mid-JSON, corrupted output, OutputCleaner failing all recovery.

---

### The `_nohf` Variant — Clean Output for Context Injection

The parser generates two markdown files per page:

- `filename.md` — full content including Page-header and Page-footer (for human reading)
- `filename_nohf.md` — content WITHOUT headers/footers (for benchmarks and context injection)

For ARCHITECT pinned document slots: ALWAYS use the _nohf variant.
Page headers/footers ("Chapter 3", "Page 47", "Confidential — Draft") are noise that
pollutes the context window. Stripping them reduces size 5-15% and improves signal quality.

---

### Grounding OCR Bbox Coordinate Scaling

The `prompt_grounding_ocr` mode requires bbox coordinates in the model's RESIZED input
space, not the original image space.

Scaling pipeline:
```
1. orig_w, orig_h = original_image.size
2. input_h, input_w = smart_resize(orig_h, orig_w, factor=28, min_pixels=3136, max_pixels=11289600)
3. scale_x = input_w / orig_w
   scale_y = input_h / orig_h
4. scaled_bbox = [int(x1*scale_x), int(y1*scale_y), int(x2*scale_x), int(y2*scale_y)]
5. Prompt: "Extract text from the given bounding box: " + str(scaled_bbox)
```

Inverse (converting model output bboxes back to original space):
```
orig_bbox = [int(bx/scale_x), int(by/scale_y), int(bx2/scale_x), int(by2/scale_y)]
```

Without this scaling the model receives coordinates that don't correspond to the actual
region in its resized view. Results will be incorrect or empty.

---

### Multi-Page PDF Threading Pattern

```
tasks = [{"origin_image": img, "page_idx": i} for i, img in enumerate(images)]

with ThreadPool(min(total_pages, 64)) as pool:
    results = list(pool.imap_unordered(_process_page, tasks))

# imap_unordered returns pages out of order — MUST sort
results.sort(key=lambda x: x["page_no"])

# Join pages with markdown page break separator
combined_md = "\n\n---\n\n".join(r["md_content"] for r in results)
```

Key points:
- imap_unordered is faster (pages return as they finish, not in order)
- Must sort by page_no after — never assume order
- Page separator is "\n\n---\n\n" — the `---` is a markdown horizontal rule
- HuggingFace inference mode: force num_thread=1 (no GPU parallelism available)
- vLLM mode: up to 64 threads, capped at actual page count

---

### Parser Instance Caching

Cache parser instances by model name. Do not recreate for each request.

```python
_parser_cache = {}

def get_parser(model_name, min_pixels=None, max_pixels=None):
    if model_name in _parser_cache:
        parser = _parser_cache[model_name]
        parser.min_pixels = min_pixels  # Update settings in-place
        parser.max_pixels = max_pixels
        return parser
    parser = DotsOCRParser(model_name=model_name, ...)
    _parser_cache[model_name] = parser
    return parser
```

For HuggingFace mode, recreating a parser instance reloads model weights — catastrophic
latency. Always check cache first.

---

### Custom Prompt — General QA Mode Only

prompt_general is the ONLY mode that accepts a user-defined prompt.
All other modes have locked templates that must not be overridden.

```python
if prompt_mode == "prompt_general":
    effective_prompt = custom_prompt or ""
else:
    effective_prompt = dict_promptmode_to_prompt[prompt_mode]
    # custom_prompt is silently ignored for all other modes
```

For general QA, temperature can be raised to 0.3-0.7 for more conversational responses.
Example custom prompts: "What is the title of this document?", "Describe the chart in panel 3",
"What year was this published?", "Which variable shows the strongest correlation?"

---

## Part 12 — Elo Evaluation Rubric

Source: tools/elo_score_prompt.py. The complete scoring system for comparing any two
OCR model outputs. Reusable for any document parsing evaluation.

A judge LLM (Gemini Flash in production) compares two model outputs against the source image.

### Score ONLY These (Content Accuracy)

- Text accuracy: character errors, missing words, hallucinated content
- Table accuracy: cell data correctness, completeness, row/column alignment
- Formula accuracy: symbol preservation, completeness, semantic equivalence

### ABSOLUTELY IGNORE These

- Markdown formatting differences (header levels, list styles, bold/italic)
- Layout, newlines, indentation, paragraph breaks
- Table border syntax differences
- Equivalent LaTeX representations
- Headers, footers, page numbers
- Image/figure processing differences — whether a model outputs a bbox, describes the image,
  extracts embedded text, or skips the figure entirely — these are ALL equivalent. NEVER
  declare a winner based on image handling.

### Tie Criteria

Declare a tie when: content is identical but format differs, table data is identical but
syntax differs, formulas are semantically equivalent, both models share the same minor error,
or main text is accurate but one model caught a footer the other missed.

Rule: It is better to judge tie than to incorrectly declare a winner based on formatting.
Content accuracy of the main text is the ONLY standard.

### Winner Criteria

Declare a winner ONLY for significant differences in: typos and character errors,
omissions of actual content, hallucinated content, table data errors, formula semantic errors.

### Output Format

```json
{"winner": "1", "reason": "Model 1 correctly identified the formula as E=mc^2 while Model 2 omitted the superscript"}
{"winner": "2", "reason": "Model 2 extracted all 5 table rows; Model 1 missed the last row entirely"}
{"winner": "tie", "reason": "Identical text content. Model 1 used HTML table syntax, Model 2 used pipe tables. Data identical. Image regions ignored per protocol."}
```

The value of "winner" must be exactly "1", "2", or "tie".

---

## Updated Quick Reference Card (Complete)

```
TASK                    MODE                      TEMP   FITZ   MODEL
----------------------------------------------------------------------
Full layout + text      prompt_layout_all_en      0.1    YES    dots.mocr
Layout boxes only       prompt_layout_only_en     0.1    YES    dots.mocr
Plain text              prompt_ocr                0.1    YES    dots.mocr
Region extraction       prompt_grounding_ocr      0.1    YES*   dots.mocr
Web page                prompt_web_parsing        0.1    NO     dots.mocr
Scene/photo text        prompt_scene_spotting     0.1    NO     dots.mocr
Chart/diagram -> SVG    prompt_image_to_svg       0.9    NO     dots.mocr-svg
General QA              prompt_general            0.1    NO     dots.mocr

* grounding_ocr: scale bbox coordinates to model input space before sending

OUTPUT VARIANTS
----------------------------------------------------------------------
filename.md             Full output (includes Page-header/footer)
filename_nohf.md        Clean output (NO headers/footers) <- USE FOR ARCHITECT
filename.json           Structured layout cells array
filename.jpg            Layout visualization
filtered=True           JSON failed; md_content is plain text fallback

MULTI-PAGE PDF
----------------------------------------------------------------------
Page separator:         \n\n---\n\n
Max threads (vLLM):     64 (capped at page count)
Max threads (HF):       1
Sort results by:        page_no (imap_unordered loses order)

ELO EVALUATION
----------------------------------------------------------------------
Score only:             Text accuracy, table data, formula semantics
Ignore completely:      Formatting, layout, image handling, headers/footers
Tie when:               Same content, different format
Judge LLM:              Gemini Flash
Output format:          {"winner": "1"|"2"|"tie", "reason": "..."}
```
