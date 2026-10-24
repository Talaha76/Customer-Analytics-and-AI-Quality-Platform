from textblob import TextBlob
def predict(text):
    p=float(TextBlob(str(text)).sentiment.polarity)
    return {'sentiment':'positive' if p>0.1 else 'negative' if p<-0.1 else 'neutral','confidence':abs(p)}
