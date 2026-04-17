import React from "react";
import ReactDOM from "react-dom/client";

function App() {
  const [key, setKey] = React.useState("");
  const [saved, setSaved] = React.useState(false);
  const [enabled, setEnabled] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    chrome.storage.local.get(["anthropicKey", "sidebarEnabled"], (result) => {
      if (result.anthropicKey) setKey(result.anthropicKey);
      setEnabled(!!result.sidebarEnabled);
      setLoading(false);
    });
  }, []);

  function save() {
    const trimmed = key.trim();
    chrome.storage.local.set({ anthropicKey: trimmed }, () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  function toggleSidebar() {
    const next = !enabled;
    setEnabled(next);
    chrome.storage.local.set({ sidebarEnabled: next });
  }

  if (loading) {
    return <div style={styles.container}><div style={styles.hint}>Loading...</div></div>;
  }

  const hasKey = key.trim().startsWith("sk-ant-");

  return (
    <div style={styles.container}>
      <div style={styles.header}>YouTube Context Sidebar</div>

      {/* Big toggle */}
      <button
        style={{ ...styles.toggleBtn, ...(enabled ? styles.toggleBtnOn : {}) }}
        onClick={toggleSidebar}
        disabled={!hasKey}
        title={hasKey ? undefined : "Save an API key first"}
      >
        <div style={{ ...styles.toggleDot, ...(enabled ? styles.toggleDotOn : {}) }} />
        {enabled ? "Sidebar on" : "Sidebar off"}
      </button>

      {!hasKey && (
        <div style={styles.warn}>Save an API key below to activate.</div>
      )}

      <div style={styles.divider} />

      <div style={styles.label}>Anthropic API Key</div>
      <input
        style={styles.input}
        type="password"
        placeholder="sk-ant-..."
        value={key}
        onChange={(e) => { setKey(e.target.value); setSaved(false); }}
        onKeyDown={(e) => { if (e.key === "Enter") save(); }}
      />

      <button
        style={{ ...styles.btn, ...(hasKey ? styles.btnActive : {}) }}
        onClick={save}
        disabled={!key.trim()}
      >
        {saved ? "Saved!" : "Save key"}
      </button>

      {!hasKey && key.trim().length > 0 && (
        <div style={styles.warn}>Key should start with sk-ant-</div>
      )}

      <div style={styles.hint}>
        Stored locally only. Get a key at{" "}
        <span style={styles.link}>console.anthropic.com</span>.
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  header: {
    fontSize: 13,
    fontWeight: 600,
    color: "#ffd750",
    marginBottom: 2,
  },
  toggleBtn: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: "#1a1a1a",
    border: "1px solid #333",
    borderRadius: 6,
    color: "#666",
    fontSize: 13,
    fontWeight: 500,
    padding: "10px 14px",
    cursor: "pointer",
    textAlign: "left" as const,
  },
  toggleBtnOn: {
    background: "#1a2a1a",
    borderColor: "#4a8a4a",
    color: "#88cc88",
  },
  toggleDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#444",
    flexShrink: 0,
  },
  toggleDotOn: {
    background: "#5a9",
  },
  divider: {
    borderTop: "1px solid #1e1e1e",
    margin: "2px 0",
  },
  label: {
    fontSize: 11,
    color: "#666",
    letterSpacing: "0.3px",
  },
  input: {
    background: "#1a1a1a",
    border: "1px solid #2a2a2a",
    borderRadius: 4,
    color: "#ccc",
    fontSize: 12,
    padding: "8px 10px",
    outline: "none",
    width: "100%",
  },
  btn: {
    background: "#1a1a1a",
    border: "1px solid #333",
    borderRadius: 4,
    color: "#666",
    fontSize: 12,
    padding: "7px 12px",
    cursor: "pointer",
  },
  btnActive: {
    borderColor: "#4a6a4a",
    color: "#ffd750",
  },
  warn: {
    fontSize: 10,
    color: "#cc8866",
    marginTop: -4,
  },
  hint: {
    fontSize: 10,
    color: "#444",
    lineHeight: 1.5,
  },
  link: {
    color: "#7aacff",
  },
};

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
