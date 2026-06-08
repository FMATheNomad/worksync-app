SUBSCRIPTION_PLANS = {
    "free": {
        "max_employees": 999999,
        "features": ["ai_assistant", "export_excel", "unlimited_employees", "priority_support", "custom_branding"],
        "price_monthly": 0,
        "price_yearly": 0,
    },
    "pro": {
        "max_employees": 50,
        "features": [
            "ai_assistant",
            "export_excel",
            "unlimited_employees",
            "priority_support",
        ],
        "price_monthly": 900,
        "price_yearly": 8640,
    },
    "enterprise": {
        "max_employees": 999999,
        "features": [
            "ai_assistant",
            "export_excel",
            "unlimited_employees",
            "priority_support",
            "custom_branding",
        ],
        "price_monthly": 2900,
        "price_yearly": 27840,
    },
}

ABSENSI_LATE_CUTOFF_TIME = "09:00"
NOTIFICATION_CUTOFF_TIME = "10:00"
