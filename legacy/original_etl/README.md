# Customer Feedback ETL Pipeline

## Overview
The Customer Feedback ETL Pipeline is an end-to-end data processing system designed to extract, transform, analyze, and store customer feedback data. The pipeline processes CSV-based reviews, applies sentiment analysis, stores results in a PostgreSQL database, and visualizes insights through an interactive dashboard.

This project demonstrates data engineering fundamentals, sentiment analysis, and backend-to-frontend data integration.

---

## Features
- Automated extraction of customer feedback from CSV files  
- Data cleaning and transformation using Pandas  
- Sentiment analysis using TextBlob and VADER  
- Classification into positive, neutral, and negative categories  
- Persistent storage using PostgreSQL and SQLAlchemy ORM  
- Interactive data visualization using Streamlit  

---

## Tech Stack
- Python  
- Pandas  
- TextBlob  
- VADER  
- SQLAlchemy  
- PostgreSQL  
- Streamlit  

---

## ETL Workflow
1. Extract raw customer feedback from CSV files.
2. Clean and normalize text data using Pandas.
3. Apply sentiment analysis using TextBlob and VADER.
4. Assign sentiment labels based on polarity thresholds.
5. Load processed data into a PostgreSQL database.
6. Query stored data for analytics and visualization.
7. Display insights in a Streamlit dashboard.

---

## Results
- Processed over 1,000 customer feedback entries  
- Achieved approximately 96% sentiment classification accuracy  
- Enabled fast querying and scalable storage  
- Delivered actionable insights via interactive visualizations  

---

## Future Improvements
- Add support for streaming data sources  
- Integrate ML-based sentiment models  
- Implement workflow orchestration  
- Add authentication and access controls  

---

By: Hamza Khan 
