import { EditorView } from '@codemirror/view'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import { sol } from '../lib/solarized'

const solarizedLightHighlight = HighlightStyle.define([
  { tag: tags.heading, color: sol.orange, fontWeight: 'bold' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strong, fontWeight: 'bold' },
  { tag: [tags.monospace, tags.processingInstruction], color: sol.cyan },
  { tag: tags.link, color: sol.blue, textDecoration: 'underline' },
  { tag: tags.url, color: sol.blue },
  { tag: tags.comment, color: sol.base01 },
  { tag: tags.keyword, color: sol.green },
  { tag: tags.string, color: sol.cyan },
  { tag: tags.number, color: sol.magenta },
  { tag: tags.meta, color: sol.base01 },
  { tag: tags.quote, color: sol.base01, fontStyle: 'italic' },
])

const solarizedDarkHighlight = HighlightStyle.define([
  { tag: tags.heading, color: sol.orange, fontWeight: 'bold' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strong, fontWeight: 'bold' },
  { tag: [tags.monospace, tags.processingInstruction], color: sol.cyan },
  { tag: tags.link, color: sol.blue, textDecoration: 'underline' },
  { tag: tags.url, color: sol.blue },
  { tag: tags.comment, color: sol.base1 },
  { tag: tags.keyword, color: sol.green },
  { tag: tags.string, color: sol.cyan },
  { tag: tags.number, color: sol.magenta },
  { tag: tags.meta, color: sol.base1 },
  { tag: tags.quote, color: sol.base1, fontStyle: 'italic' },
])

export function editorTheme(dark: boolean) {
  const highlight = dark ? solarizedDarkHighlight : solarizedLightHighlight
  const bg = dark ? sol.base03 : sol.base3
  const fg = dark ? sol.base0 : sol.base00
  const gutterFg = dark ? sol.base01 : sol.base1
  const selBg = dark ? sol.base02 : sol.base2
  const cursorColor = dark ? sol.base0 : sol.base00

  return [
    syntaxHighlighting(highlight),
    EditorView.theme(
      {
        '&': {
          height: '100%',
          fontSize: '13px',
          backgroundColor: bg,
          color: fg,
        },
        '.cm-scroller': {
          overflow: 'auto',
          fontFamily:
            "'JetBrainsMono Nerd Font Mono', 'JetBrains Mono', ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
        },
        '.cm-content': {
          padding: '16px',
          caretColor: cursorColor,
        },
        '.cm-gutters': {
          background: bg,
          border: 'none',
          color: gutterFg,
        },
        '.cm-activeLineGutter': {
          color: fg,
          backgroundColor: 'transparent',
        },
        '.cm-math-inline .katex': {
          fontSize: '1em',
          color: fg,
        },
        '.cm-math-block': {
          margin: '8px 0',
          textAlign: 'center',
        },
        '.cm-math-block .katex': {
          fontSize: '1.1em',
          color: fg,
        },
        '.cm-image-widget img': {
          maxWidth: '100%',
          borderRadius: '4px',
        },
        '&.cm-focused': {
          outline: 'none',
        },
        '.cm-cursor': {
          borderLeftColor: cursorColor,
        },
        '.cm-fat-cursor': {
          background: dark
            ? 'rgba(147, 161, 161, 0.4) !important'
            : 'rgba(101, 123, 131, 0.4) !important',
          color: 'transparent !important',
        },
        '&:not(.cm-focused) .cm-fat-cursor': {
          background: 'transparent !important',
          outline: dark
            ? `1px solid ${sol.base0}`
            : `1px solid ${sol.base00}`,
          color: 'transparent !important',
        },
        '.cm-selectionBackground': {
          background: `${selBg} !important`,
        },
        '&.cm-focused .cm-selectionBackground': {
          background: `${selBg} !important`,
        },
        '.cm-activeLine': {
          backgroundColor: dark
            ? 'rgba(147, 161, 161, 0.05)'
            : 'rgba(101, 123, 131, 0.05)',
        },
      },
      { dark },
    ),
  ]
}
