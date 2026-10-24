"""
export_sample.py
----------------
This script exports a random sample of reviews from the DB
so you can manually label them and check model accuracy.
"""

import os
import pandas as pd
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Load DB connection from .env
load_dotenv()
DB_URL = os.getenv("DB_URL", "postgresql://postgres:PASSWORD@localhost:5432/mydb")
engine = create_engine(DB_URL)

# SQL query: get 50 random distinct reviews
query = text("""
    SELECT review
    FROM (
        SELECT DISTINCT review
        FROM customer_feedback
        WHERE review IS NOT NULL AND review <> ''
    ) AS d
    ORDER BY RANDOM()
    LIMIT 50;
""")

# Run query and store in dataframe
df = pd.read_sql(query, engine)

# Add a new column called 'label' to fill in manually
df["label"] = ""  # you will write: positive, neutral, or negative

# Save to CSV for manual labeling
df.to_csv("labeled_sample.csv", index=False)

print("Wrote labeled_sample.csv — now open and fill the 'label' column, then run: python accuracy_check.py")
