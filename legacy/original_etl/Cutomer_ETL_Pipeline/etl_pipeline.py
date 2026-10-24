"""
etl_pipeline.py
----------------
ETL pipeline to take raw customer feedback, clean it, apply sentiment analysis,
and load the results into PostgreSQL.

ETL = Extract → Transform → Load
- Extract: read raw CSV with feedback
- Transform: clean, deduplicate, and apply sentiment analysis using rules + VADER
- Load: write enriched dataset into PostgreSQL table `customer_feedback`
"""

import os
import re
import pandas as pd
from sqlalchemy import create_engine
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
from dotenv import load_dotenv

# ---------- LOAD ENVIRONMENT VARIABLES ----------
# Loads the `.env` file so we can read DB_URL instead of hardcoding credentials.
load_dotenv()
DB_URL = os.getenv("DB_URL", "postgresql://postgres:PASSWORD@localhost:5432/mydb")

# ---------- EXTRACT STEP ----------
print("Extracting data...")
# Load your dataset of customer reviews. It must have at least a 'review' column.
df = pd.read_csv("data/feedback.csv")

# ---------- TRANSFORM STEP ----------
print("Cleaning & transforming data...")

# Drop duplicate rows so you don’t double count the same review
df.drop_duplicates(inplace=True)

# Drop rows where 'review' is NULL or missing
df.dropna(subset=["review"], inplace=True)

# Create a VADER sentiment analyzer
sia = SentimentIntensityAnalyzer()

# Adjust VADER’s built-in lexicon so neutral words stay neutral in this dataset.
# Without this, words like "fine" or "average" might be treated as slightly positive/negative.
sia.lexicon.update({
    "fine": 0.0, "serviceable": 0.0, "okay": 0.0, "ok": 0.0,
    "average": 0.0, "plain": 0.0, "standard": 0.0,
    "as expected": 0.0, "nothing special": 0.0,
    "met expectations": 0.0, "overall typical experience": 0.0,
    "standard option for the price": 0.0,
    "does what it says": 0.0, "works as expected": 0.0,
    "basic features": 0.0,
})

# Utility function to build regex patterns for triggers
def _rx(words_or_phrases):
    # This compiles all given words into a case-insensitive regex pattern.
    return re.compile(r"(?i)\b(" + "|".join(map(re.escape, words_or_phrases)) + r")\b")

# Negative trigger phrases (words that almost always mean bad review)
NEG_TRIGGERS = _rx([
    "broke after one day","broken","broke","keeps crashing","crashing",
    "stopped working","refund","cheap","poorly made","disappointed",
    "waste of money","defective","unhelpful","arrived damaged",
    "overheats","faulty","flimsy","unreliable","laggy",
    "battery drains fast","buggy"
])

# Neutral trigger phrases (words that usually mean neither good nor bad)
NEU_TRIGGERS = _rx([
    "okay","ok","fine","average","as expected","nothing special",
    "serviceable","plain","standard","decent",
    "does what it says","works as expected","met expectations",
    "overall typical experience","standard option for the price",
    "basic features","plain design but usable","fine for daily use",
    "service was okay and acceptable"
])

# Positive trigger phrases (words that clearly show praise)
POS_TRIGGERS = _rx([
    "fantastic value","very reliable","worth every penny","would buy again",
    "love this purchase","excellent quality","works perfectly",
    "great build","feels durable","delivers exactly what i need",
    "super impressed","performs consistently",
    "support was helpful and fast","setup was easy and smooth",
    "solid performance and dependable"
])

# Negation words (like "not") which can flip meaning
NEGATIONS = _rx(["not","no","never","hardly","barely"])

def _negated(text, span):
    """
    Check if a negation word is found near the phrase.
    Looks 25 characters before the phrase to detect 'not good', etc.
    """
    start = max(0, span[0] - 25)
    return bool(NEGATIONS.search(text[start:span[0]]))

def get_sentiment(text: str) -> str:
    """
    Decide sentiment for a given review string.
    Priority: NEG → NEU → POS → fallback VADER
    """
    t = str(text).lower().strip()

    # 1. Check for negative triggers
    m = NEG_TRIGGERS.search(t)
    if m and not _negated(t, m.span()):
        return "negative"

    # 2. Check for neutral triggers
    m = NEU_TRIGGERS.search(t)
    if m:
        return "neutral" if not _negated(t, m.span()) else "positive"

    # 3. Check for positive triggers
    m = POS_TRIGGERS.search(t)
    if m:
        return "positive" if not _negated(t, m.span()) else "neutral"

    # 4. Otherwise, fallback to VADER score
    score = sia.polarity_scores(t)["compound"]
    if score >= 0.20:
        return "positive"
    elif score <= -0.20:
        return "negative"
    else:
        return "neutral"

# Apply the function to every review
df["sentiment"] = df["review"].apply(get_sentiment)

# ---------- LOAD STEP ----------
print("Loading data into PostgreSQL...")

# Create a DB engine using SQLAlchemy
engine = create_engine(DB_URL)

# Save the transformed data into table `customer_feedback`
df.to_sql("customer_feedback", engine, if_exists="replace", index=False)

print("✅ ETL Pipeline completed successfully!")
