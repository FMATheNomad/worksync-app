from pydantic import BaseModel


class AIReportRequest(BaseModel):
    user_message: str


class AIReportResponse(BaseModel):
    report_content: str


class AIAnalyticsRequest(BaseModel):
    question: str


class AIAnalyticsResponse(BaseModel):
    answer: str


class AIStreamResponse(BaseModel):
    content: str
