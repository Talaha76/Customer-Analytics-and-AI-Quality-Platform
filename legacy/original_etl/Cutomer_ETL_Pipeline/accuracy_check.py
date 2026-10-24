"""
accuracy_check.py
-----------------
Compares your pipeline predictions (from DB) against manual labels in CSV.
- Loads predictions from PostgreSQL
- Loads human labels from labeled_sample.csv
- Calculates accuracy
- Prints confusion matrix
- Saves disagreements to disagreements.csv
"""

import os
import pandas as pd
from sqlalchemy import create_engine
from dotenv import load_dotenv


def get_accuracy() -> float:
    """
    Runs the accuracy check and returns accuracy as a float (0–1).
    Also saves disagreements.csv.
    """
    # Load DB URL
    load_dotenv()
    DB_URL = os.getenv("DB_URL", "postgresql://postgres:PASSWORD@localhost:5432/mydb")
    engine = create_engine(DB_URL)

    # Get model predictions from DB
    preds = pd.read_sql(
        "SELECT review, sentiment AS pred FROM customer_feedback", engine
    ).drop_duplicates("review")

    # Get human-labeled data
    gold = pd.read_csv("labeled_sample.csv")

    # Normalize text (strip whitespace, lowercase)
    gold["review"] = gold["review"].astype(str).str.strip()
    gold["label"] = gold["label"].astype(str).str.strip().str.lower()
    preds["review"] = preds["review"].astype(str).str.strip()
    preds["pred"] = preds["pred"].astype(str).str.strip().str.lower()

    # Merge human vs model predictions
    df = gold.merge(preds, on="review", how="left")

    # Drop rows missing either label or prediction
    eval_df = df.dropna(subset=["label", "pred"]).copy()

    # Accuracy = % of correct predictions
    eval_df["correct"] = eval_df["label"] == eval_df["pred"]
    accuracy = eval_df["correct"].mean() if len(eval_df) else 0.0

    # Save disagreements
    eval_df.loc[~eval_df["correct"], ["review", "label", "pred"]].to_csv(
        "disagreements.csv", index=False
    )

    return accuracy


# -------------------------------------------------------------------------
# If you run this file directly: print metrics and confusion matrix
# -------------------------------------------------------------------------
if __name__ == "__main__":
    acc = get_accuracy()
    print(f"Accuracy: {acc:.2%}")

    # Reload the eval_df to print confusion matrix
    load_dotenv()
    DB_URL = os.getenv("DB_URL", "postgresql://postgres:PASSWORD@localhost:5432/mydb")
    engine = create_engine(DB_URL)

    preds = pd.read_sql(
        "SELECT review, sentiment AS pred FROM customer_feedback", engine
    ).drop_duplicates("review")
    gold = pd.read_csv("labeled_sample.csv")
    gold["review"] = gold["review"].astype(str).str.strip()
    gold["label"] = gold["label"].astype(str).str.strip().str.lower()
    preds["review"] = preds["review"].astype(str).str.strip()
    preds["pred"] = preds["pred"].astype(str).str.strip().str.lower()
    df = gold.merge(preds, on="review", how="left")
    eval_df = df.dropna(subset=["label", "pred"]).copy()

    cm = pd.crosstab(eval_df["label"], eval_df["pred"], dropna=False)
    print("\nConfusion matrix (rows=true, cols=pred):")
    print(cm)

    print("\nSaved disagreements to disagreements.csv (if any).")
