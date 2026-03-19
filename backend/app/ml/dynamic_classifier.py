from __future__ import annotations

import numpy as np
from sklearn.base import BaseEstimator, ClassifierMixin
from sklearn.preprocessing import LabelEncoder


class DynamicSequenceClassifier(BaseEstimator, ClassifierMixin):
    def __init__(self, estimator):
        self.estimator = estimator
        self.label_encoder = LabelEncoder()
        self.classes_ = None

    def fit(self, X, y):
        y_enc = self.label_encoder.fit_transform(y)
        self.estimator.fit(X, y_enc)
        self.classes_ = self.label_encoder.classes_.astype(str)
        return self

    def predict(self, X):
        pred = self.estimator.predict(X)
        return self.label_encoder.inverse_transform(pred)

    def predict_proba(self, X):
        return self.estimator.predict_proba(X)
