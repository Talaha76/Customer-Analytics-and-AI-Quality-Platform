"""
dashboard.py
------------
A Streamlit dashboard to visualize customer feedback sentiment.

Features:
- Shows total feedback count
- Displays bar chart of sentiment distribution
- Shows a sample table of reviews
"""

import os
import pandas as pd
import streamlit as st
from sqlalchemy import create_engine
from dotenv import load_dotenv

# Load DB connection
load_dotenv()
DB_URL = os.getenv("DB_URL", "postgresql://postgres:PASSWORD@localhost:5432/mydb")

# Connect to Postgres
engine = create_engine(DB_URL)

# Load the data into a DataFrame
df = pd.read_sql("SELECT * FROM customer_feedback", engine)

# ---------- STREAMLIT UI ----------
st.title("📊 Customer Feedback Sentiment Analysis")

# Metric: total feedback count
st.metric("Total Feedback", len(df))

# Show distribution of sentiments
st.write("### Sentiment Distribution")
st.bar_chart(df["sentiment"].value_counts())

# Show first 10 reviews in a table
st.write("### Sample Feedback")
st.dataframe(df.head(10))
