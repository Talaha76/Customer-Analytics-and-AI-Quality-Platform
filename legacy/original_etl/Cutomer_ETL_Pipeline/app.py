# app.py — Streamlit frontend for accuracy_check.py with compact layout + front-end logging + colored charts
import streamlit as st
import pandas as pd
from pathlib import Path
import altair as alt

# --- Import accuracy script ---
try:
    from accuracy_check import get_accuracy
except Exception:
    get_accuracy = None

# --- Page config ---
st.set_page_config(page_title="Model Accuracy Dashboard", layout="wide")
st.title("📊 Model Performance Dashboard")

# --- Load data files (best-effort) ---
gold, rec_updates = None, None
try:
    gold = pd.read_csv("labeled_sample.csv")
except Exception:
    pass

try:
    rec_updates = pd.read_csv("disagreements.csv")  # UI label: Recommendation Updates
except Exception:
    pass

hist_file = Path("accuracy_history.csv")
history = pd.read_csv(hist_file) if hist_file.exists() else pd.DataFrame()

# --- Compute current accuracy via your script ---
acc, acc_error = None, None
if get_accuracy:
    try:
        acc = float(get_accuracy())
    except Exception as e:
        acc_error = e

# --- Top KPIs ---
col1, col2, col3 = st.columns(3)

if get_accuracy and acc_error is None and acc is not None:
    col1.metric("Accuracy", f"{acc*100:.2f}%")
elif not get_accuracy:
    col1.error("⚠️ Could not import accuracy_check.py (no get_accuracy found)")
else:
    col1.error("Error in get_accuracy()")
    col1.exception(acc_error)

col2.metric("Human-Labeled Reviews", f"{len(gold):,}" if gold is not None else "—")
col3.metric("Recommendation Updates", f"{len(rec_updates):,}" if rec_updates is not None else "—")

# --- Front-end logging button ---
with st.container():
    log_col, spacer, info_col = st.columns([1, 4, 3])

    if st.session_state.get("just_logged_ok"):
        st.session_state["just_logged_ok"] = False
        st.success("Logged this run to accuracy_history.csv")

    if st.session_state.get("just_logged_err"):
        st.session_state["just_logged_err"] = None
        st.error("Could not log this run.")

    def log_run():
        try:
            cur_acc = float(get_accuracy()) if get_accuracy else None
            labeled_rows = len(gold) if gold is not None else (
                pd.read_csv("labeled_sample.csv").shape[0] if Path("labeled_sample.csv").exists() else None
            )
            updates = len(rec_updates) if rec_updates is not None else (
                pd.read_csv("disagreements.csv").shape[0] if Path("disagreements.csv").exists() else 0
            )

            cur_hist = pd.read_csv(hist_file) if hist_file.exists() else pd.DataFrame()
            if not cur_hist.empty and "run" in cur_hist.columns:
                next_run = int(cur_hist["run"].iloc[-1]) + 1
            else:
                next_run = 1

            new_row = pd.DataFrame([{
                "timestamp": pd.Timestamp.now().isoformat(timespec="seconds"),
                "run": next_run,
                "accuracy": round(cur_acc, 6) if cur_acc is not None else None,
                "labeled_rows": int(labeled_rows) if labeled_rows is not None else None,
                "updates": int(updates) if updates is not None else None,
            }])

            new_row.to_csv(hist_file, mode="a", header=not hist_file.exists(), index=False)
            st.session_state["just_logged_ok"] = True
            st.rerun()
        except Exception as e:
            st.session_state["just_logged_err"] = True
            with info_col:
                st.exception(e)
            st.rerun()

    log_col.button("➕ Log this run to history", on_click=log_run, use_container_width=True)
    with info_col:
        st.caption("Logs timestamp, run #, accuracy, labeled rows, and recommendation updates into accuracy_history.csv")

st.divider()

# --- Two compact charts side by side (colored) ---
left, right = st.columns(2)

with left:
    st.subheader("Label Distribution")
    if gold is not None and "label" in gold.columns:
        label_counts = gold["label"].astype(str).str.lower().value_counts().reset_index()
        label_counts.columns = ["label", "count"]

        color_scale = alt.Scale(
            domain=["positive", "neutral", "negative"],
            range=["#2ecc71", "#f1c40f", "#e74c3c"]  # green, yellow, red
        )

        chart = (
            alt.Chart(label_counts)
            .mark_bar()
            .encode(
                x=alt.X("label:N", sort="-y", title="Label"),
                y=alt.Y("count:Q", title="Count"),
                color=alt.Color("label:N", scale=color_scale, legend=None)
            )
        )
        st.altair_chart(chart, use_container_width=True)
    else:
        st.info("Need labeled_sample.csv with a 'label' column.")

with right:
    st.subheader("Recommendation Updates Breakdown")
    if rec_updates is not None and {"label", "pred"}.issubset(rec_updates.columns):
        mismatch_counts = rec_updates.groupby(["label", "pred"]).size().reset_index(name="count")

        color_scale = alt.Scale(
            domain=["positive", "neutral", "negative"],
            range=["#2ecc71", "#f1c40f", "#e74c3c"]
        )

        chart = (
            alt.Chart(mismatch_counts)
            .mark_bar()
            .encode(
                x=alt.X("pred:N", title="Predicted"),
                y=alt.Y("count:Q", title="Count"),
                color=alt.Color("pred:N", scale=color_scale),
                column=alt.Column("label:N", title="True Label")  # faceted by true label
            )
        )
        st.altair_chart(chart, use_container_width=True)
    else:
        st.info("Need disagreements.csv with 'label' and 'pred'.")

st.divider()

# --- Accuracy Over Time ---
st.subheader("📈 Accuracy Over Time")
if not history.empty and "accuracy" in history.columns:
    if "timestamp" in history.columns:
        history["timestamp"] = pd.to_datetime(history["timestamp"], errors="coerce")
    history["accuracy_pct"] = history["accuracy"].astype(float) * 100.0

    c1, c2 = st.columns(2)
    with c1:
        st.caption("By timestamp (line)")
        idx = "timestamp" if "timestamp" in history.columns and history["timestamp"].notna().any() else "run"
        st.line_chart(history.set_index(idx)["accuracy_pct"])
    with c2:
        st.caption("By run # (bar)")
        if "run" in history.columns:
            st.bar_chart(history.set_index("run")["accuracy_pct"])
        else:
            st.info("No 'run' column in history yet.")

    k1, k2, k3 = st.columns(3)
    k1.metric("Latest Accuracy", f"{history['accuracy_pct'].iloc[-1]:.2f}%")
    k2.metric("Total Runs Logged", f"{history.shape[0]}")
    if {"labeled_rows", "updates"}.issubset(history.columns):
        last_lab = history["labeled_rows"].dropna().iloc[-1] if history["labeled_rows"].notna().any() else None
        last_upd = history["updates"].dropna().iloc[-1] if history["updates"].notna().any() else None
        k3.metric("Last Run: Labeled / Updates",
                  f"{int(last_lab) if last_lab is not None else '—'} / {int(last_upd) if last_upd is not None else '—'}")
    else:
        k3.metric("Last Run: Labeled / Updates", "—")
else:
    st.info("No accuracy history yet. Click “➕ Log this run to history” to create the first point.")

st.divider()

# --- Small preview ---
st.subheader("🔍 Sample of Recommendation Updates")
if rec_updates is not None and not rec_updates.empty:
    st.dataframe(rec_updates.head(5), use_container_width=True)
else:
    st.info("No recommendation updates to preview.")
