import React from "react";
import type { TermCard } from "../utils/messages";

interface SidebarProps {
  cards: TermCard[];
  hasCaption: boolean;
  noKey: boolean;
  onDismiss: (id: string) => void;
  onLookup: (term: string) => void;
  onSimplify: (cardId: string) => void;
  onCollapseChange?: (collapsed: boolean) => void;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function Sidebar({ cards, hasCaption, noKey, onDismiss, onLookup, onSimplify, onCollapseChange }: SidebarProps) {
  const [query, setQuery] = React.useState("");
  const [collapsed, setCollapsed] = React.useState(false);

  function toggleCollapse() {
    const next = !collapsed;
    setCollapsed(next);
    onCollapseChange?.(next);
  }

  const manualCards = cards.filter((c) => !c.isAuto);
  const autoCards = cards.filter((c) => c.isAuto);
  const ordered = [...manualCards, ...autoCards];

  return (
    <div style={styles.root}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <div style={styles.title}>Context</div>
          <div style={styles.subtitle}>
            {hasCaption ? "Watching for unfamiliar terms" : "No captions — manual lookup only"}
          </div>
        </div>
        <button style={styles.collapseBtn} onClick={toggleCollapse} title="Collapse sidebar">
          &#x276F;
        </button>
      </div>

      {/* No API key banner */}
      {noKey && (
        <div style={styles.banner}>
          No API key set. Click the extension icon and paste your OpenAI key.
        </div>
      )}

      {/* Card feed */}
      <div style={styles.feed}>
        {ordered.length === 0 && !noKey && (
          <div style={styles.empty}>
            {hasCaption
              ? "Watching the transcript. Cards appear when unfamiliar terms come up."
              : "Select any text on the page to look it up."}
          </div>
        )}
        {ordered.map((card) => (
          <Card key={card.id} card={card} onDismiss={onDismiss} onSimplify={onSimplify} />
        ))}
      </div>

      {/* Manual lookup bar */}
      <div style={styles.lookupBar}>
        <div style={styles.lookupLabel}>Manual lookup</div>
        <div style={styles.lookupRow}>
          <input
            style={styles.lookupInput}
            type="text"
            placeholder="type a term..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && query.trim()) {
                onLookup(query.trim());
                setQuery("");
              }
            }}
          />
          <button
            style={styles.lookupBtn}
            onClick={() => {
              if (query.trim()) {
                onLookup(query.trim());
                setQuery("");
              }
            }}
          >
            Look up
          </button>
        </div>
        <div style={styles.hint}>Or select any text on the page</div>
      </div>
    </div>
  );
}

function Card({ card, onDismiss, onSimplify }: { card: TermCard; onDismiss: (id: string) => void; onSimplify: (cardId: string) => void }) {
  const clickable = !card.isPending && !card.isError;

  function handleCardClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (clickable) onSimplify(card.id);
  }

  return (
    <div
      style={{
        ...styles.card,
        ...(card.isError ? styles.cardError : {}),
        ...(clickable ? styles.cardClickable : {}),
      }}
      onClick={handleCardClick}
      title={clickable ? "Click for a simpler explanation" : undefined}
    >
      <button
        style={styles.dismiss}
        onClick={(e) => { e.stopPropagation(); onDismiss(card.id); }}
      >
        ✕
      </button>
      <div style={styles.cardTerm}>
        {card.term}
        <span style={styles.timestamp}>{formatTime(card.timestamp)}</span>
        {!card.isAuto && <span style={styles.badge}>manual</span>}
      </div>
      {card.isPending ? (
        <div style={styles.skeleton} />
      ) : card.isError ? (
        <div style={styles.errorText}>{card.errorMessage}</div>
      ) : (
        <>
          <div style={styles.definition}>{card.definition}</div>
          <div style={styles.simplifyHint}>Click card for simpler explanation</div>
        </>
      )}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
// All inline to avoid CSS conflicts with YouTube's global styles.

const styles: Record<string, React.CSSProperties> = {
  root: {
    position: "fixed",
    top: 0,
    right: 0,
    width: 280,
    height: "100vh",
    background: "#111",
    borderLeft: "1px solid #2a2a2a",
    display: "flex",
    flexDirection: "column",
    fontFamily: "system-ui, -apple-system, sans-serif",
    zIndex: 99999,
    boxSizing: "border-box",
    color: "#e0e0e0",
  },
  collapseBtn: {
    background: "none",
    border: "none",
    color: "#444",
    cursor: "pointer",
    fontSize: 13,
    padding: "2px 4px",
    lineHeight: 1,
    marginLeft: "auto",
    flexShrink: 0,
  },
  header: {
    padding: "14px 16px 12px",
    borderBottom: "1px solid #2a2a2a",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
  },
  title: { fontSize: 13, fontWeight: 600, color: "#ccc", letterSpacing: "0.3px" },
  subtitle: { fontSize: 10, color: "#555", marginTop: 2 },
  banner: {
    background: "#2a1a1a",
    borderBottom: "1px solid #5a2a2a",
    color: "#ff9999",
    fontSize: 11,
    padding: "10px 14px",
    lineHeight: 1.5,
  },
  feed: {
    flex: 1,
    overflowY: "auto",
    padding: "12px 12px 0",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  empty: { fontSize: 12, color: "#444", textAlign: "center", padding: "24px 0", lineHeight: 1.6 },
  card: {
    background: "#1a1a1a",
    border: "1px solid #2a2a2a",
    borderRadius: 6,
    padding: 12,
    position: "relative",
  },
  cardError: { borderColor: "#5a2a2a", background: "#1a1212" },
  dismiss: {
    position: "absolute",
    top: 7,
    right: 7,
    background: "none",
    border: "none",
    color: "#444",
    cursor: "pointer",
    fontSize: 10,
    padding: 2,
    lineHeight: 1,
  },
  cardTerm: {
    fontSize: 13,
    fontWeight: 600,
    color: "#ffd750",
    marginBottom: 6,
    display: "flex",
    alignItems: "center",
    gap: 6,
    paddingRight: 16,
    flexWrap: "wrap" as const,
  },
  timestamp: {
    fontSize: 10,
    color: "#555",
    fontWeight: 400,
    background: "#222",
    borderRadius: 3,
    padding: "1px 5px",
  },
  badge: {
    fontSize: 9,
    background: "#2a3a2a",
    color: "#88cc88",
    borderRadius: 3,
    padding: "1px 5px",
    fontWeight: 500,
  },
  cardClickable: {
    cursor: "pointer",
  },
  definition: { fontSize: 12, lineHeight: 1.55, color: "#999" },
  simplifyHint: {
    marginTop: 5,
    fontSize: 9,
    color: "#3a3a3a",
    letterSpacing: "0.3px",
  },
  errorText: { fontSize: 12, color: "#cc6666", lineHeight: 1.4 },
  skeleton: {
    height: 36,
    background: "linear-gradient(90deg, #222 25%, #2a2a2a 50%, #222 75%)",
    backgroundSize: "200% 100%",
    borderRadius: 4,
    animation: "pulse 1.5s infinite",
  },
  lookupBar: {
    padding: 12,
    borderTop: "1px solid #2a2a2a",
    flexShrink: 0,
  },
  lookupLabel: {
    fontSize: 10,
    color: "#555",
    marginBottom: 6,
    letterSpacing: "0.5px",
    textTransform: "uppercase" as const,
  },
  lookupRow: { display: "flex", gap: 6 },
  lookupInput: {
    flex: 1,
    background: "#1a1a1a",
    border: "1px solid #333",
    borderRadius: 4,
    color: "#ccc",
    fontSize: 12,
    padding: "7px 10px",
    outline: "none",
  },
  lookupBtn: {
    background: "#2a2a1a",
    border: "1px solid #555",
    borderRadius: 4,
    color: "#ffd750",
    fontSize: 11,
    padding: "7px 10px",
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
  },
  hint: { fontSize: 10, color: "#444", marginTop: 6 },
};
