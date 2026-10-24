from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
_a=SentimentIntensityAnalyzer()
def predict(text):
    c=_a.polarity_scores(str(text))['compound']
    return {'sentiment':'positive' if c>=0.2 else 'negative' if c<=-0.2 else 'neutral','confidence':abs(c)}
