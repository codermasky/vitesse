"""
Financial Services Knowledge Base: Seed Data

Pre-loads the system with knowledge about major financial APIs and standards.
Enables self-onboarding to new financial integrations without manual updates.

Coverage:
- Core Integrators: Plaid, Stripe, Yodlee
- Regulatory Frameworks: PSD2 (Europe), FDX (Financial Data Exchange)
- Domain Standards: Open Banking, Payment APIs, Data Aggregation
"""

from typing import Dict, List, Any

# =========== Core Financial APIs ===========

PLAID_API_KNOWLEDGE = {
    "api_name": "Plaid",
    "category": "open_banking",
    "region": ["US", "EU", "UK"],
    "description": "Open Banking API for financial institution data aggregation",
    "doc_url": "https://plaid.com/docs/",
    "spec_url": "https://github.com/plaid/plaid-openapi/blob/master/openapi.json",
    "base_url": "https://production.plaid.com",
    "authentication": {
        "type": "oauth2",
        "client_id_header": "client_id",
        "secret_header": "secret",
        "flows": ["authorization_code", "client_credentials"],
    },
    "endpoints": [
        {
            "path": "/link/token/create",
            "method": "POST",
            "description": "Create a Link token for initialization",
            "required_params": ["client_id", "secret", "client_name", "user"],
        },
        {
            "path": "/accounts/get",
            "method": "POST",
            "description": "Get accounts for access token",
            "required_params": ["client_id", "secret", "access_token"],
        },
        {
            "path": "/transactions/get",
            "method": "POST",
            "description": "Get transactions",
            "required_params": [
                "client_id",
                "secret",
                "access_token",
                "start_date",
                "end_date",
            ],
            "pagination": {"type": "offset", "params": ["offset", "count"]},
        },
        {
            "path": "/auth/get",
            "method": "POST",
            "description": "Get auth credentials (beta)",
            "required_params": ["client_id", "secret", "access_token"],
        },
    ],
    "schemas": {
        "account": ["account_id", "name", "type", "subtype", "mask", "official_name"],
        "transaction": [
            "transaction_id",
            "account_id",
            "amount",
            "currency_code",
            "date",
            "name",
            "merchant_name",
            "category",
        ],
        "institution": ["institution_id", "name", "url"],
    },
    "rate_limits": {
        "per_minute": 600,
        "per_day": 10000,
        "burst": 100,
    },
    "compliance": ["PSD2", "FDX", "GDPR"],
    "tags": ["payments", "banking", "data-aggregation", "open-banking", "fintech"],
}

STRIPE_API_KNOWLEDGE = {
    "api_name": "Stripe",
    "category": "payments",
    "region": "global",
    "description": "Payment processing and financial services platform",
    "doc_url": "https://stripe.com/docs/api",
    "spec_url": "https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.json",
    "base_url": "https://api.stripe.com",
    "authentication": {
        "type": "bearer_token",
        "header": "Authorization",
        "format": "Bearer sk_live_... or sk_test_...",
    },
    "endpoints": [
        {
            "path": "/v1/customers",
            "method": ["GET", "POST"],
            "description": "Create, update, list customers",
            "required_params": ["api_key"],
        },
        {
            "path": "/v1/payment_intents",
            "method": ["GET", "POST"],
            "description": "Create and manage payment intents",
            "required_params": ["amount", "currency"],
        },
        {
            "path": "/v1/charges",
            "method": ["GET", "POST"],
            "description": "Create and list charges",
            "required_params": ["amount", "currency", "source"],
        },
        {
            "path": "/v1/transfers",
            "method": ["GET", "POST"],
            "description": "Transfer funds",
            "required_params": ["amount", "currency", "destination"],
        },
        {
            "path": "/v1/accounts",
            "method": ["GET", "POST"],
            "description": "Manage connected accounts",
        },
    ],
    "schemas": {
        "customer": ["id", "email", "name", "phone", "address", "created", "balance"],
        "payment_intent": [
            "id",
            "client_secret",
            "amount",
            "currency",
            "status",
            "customer",
            "charges",
        ],
        "charge": ["id", "amount", "currency", "customer", "status", "receipt_email"],
    },
    "rate_limits": {
        "per_second": 100,
        "burst": 250,
    },
    "compliance": ["PCI-DSS", "GDPR", "SOC2"],
    "tags": ["payments", "fintech", "monetization", "billing"],
}

YODLEE_API_KNOWLEDGE = {
    "api_name": "Yodlee",
    "category": "data_aggregation",
    "region": "US",
    "description": "Financial data aggregation and enrichment platform",
    "doc_url": "https://developer.yodlee.com/docs/",
    "base_url": "https://api.yodlee.com",
    "authentication": {
        "type": "oauth2",
        "flows": ["authorization_code"],
    },
    "endpoints": [
        {
            "path": "/user/login",
            "method": "POST",
            "description": "User login",
        },
        {
            "path": "/user/account",
            "method": ["GET", "POST"],
            "description": "Get user accounts",
        },
        {
            "path": "/user/account/{id}/holder",
            "method": "GET",
            "description": "Get account holder info",
        },
        {
            "path": "/user/account/transaction",
            "method": "GET",
            "description": "Get transactions",
            "pagination": {"type": "cursor"},
        },
    ],
    "schemas": {
        "account": [
            "id",
            "accountName",
            "accountNumber",
            "accountType",
            "balance",
            "currency",
        ],
        "transaction": ["id", "date", "amount", "description", "category", "type"],
    },
    "rate_limits": {
        "per_minute": 120,
    },
    "compliance": ["PSD2", "FDX"],
    "tags": ["data-aggregation", "banking", "wealth", "fintech"],
}

# =========== Financial Standards & Regulations ===========

PSD2_STANDARD = {
    "standard": "PSD2",
    "full_name": "Payment Services Directive 2",
    "region": "European Union",
    "version": "1.3.8",
    "doc_url": "https://www.eba.europa.eu/regulation-and-policy/payment-services-and-electronic-money",
    "description": "Regulatory framework for payment services in EU",
    "key_requirements": [
        "Open Banking - Banks must expose APIs to third-party providers",
        "Strong Customer Authentication (SCA) - Multi-factor authentication required",
        "Data Access - Secure technical and organizational measures",
        "Liability - Clear assignment of liability in payment chains",
        "Transparency - Information about charges and services",
    ],
    "technical_specs": {
        "authentication": "OAuth2 with SCA/MFA",
        "data_format": "JSON",
        "certifications": ["eIDAS", "QWAC"],
        "encryption": "TLS 1.2+",
    },
    "api_patterns": [
        {
            "pattern_name": "Account Information Service",
            "endpoints": [
                "/accounts",
                "/accounts/{account-id}",
                "/accounts/{account-id}/transactions",
                "/accounts/{account-id}/transactions?date_range",
            ],
        },
        {
            "pattern_name": "Payment Initiation Service",
            "endpoints": [
                "/payments/sepa-credit-transfers",
                "/payments/instant-sepa-credit-transfers",
                "/payments/payment-status",
            ],
        },
    ],
    "data_models": {
        "account": [
            "account_id",
            "iban",
            "bban",
            "currency",
            "name",
            "product",
            "cash_account_type",
            "status",
            "usage",
            "details",
        ],
        "transaction": [
            "transaction_id",
            "booking_date",
            "value_date",
            "amount",
            "currency",
            "purpose",
            "creditor_name",
            "creditor_account",
            "debtor_name",
            "debtor_account",
            "remittance_information",
            "return_debit_notes",
        ],
    },
}

FDX_STANDARD = {
    "standard": "FDX",
    "full_name": "Financial Data Exchange",
    "region": "International",
    "version": "5.0",
    "doc_url": "https://financialdataexchange.org/",
    "description": "Open standard for secure financial data exchange",
    "key_requirements": [
        "Data Minimization - Only request necessary data",
        "User Control - Clear consent and revocation mechanisms",
        "Transparency - Easy-to-understand data usage",
        "Security - End-to-end encryption and secure APIs",
        "Interoperability - Standard data models across providers",
    ],
    "technical_specs": {
        "authentication": "OAuth2",
        "transport": "REST/JSON over HTTPS",
        "security": ["PKI", "TLS 1.2+", "Message-level encryption"],
    },
    "data_models": {
        "party": ["id", "partyId", "partyType", "name", "email", "phone"],
        "account": ["id", "accountId", "accountType", "balance", "currency", "status"],
        "transaction": [
            "id",
            "transactionId",
            "date",
            "amount",
            "currency",
            "description",
        ],
    },
}

OPEN_BANKING_STANDARD = {
    "standard": "Open Banking",
    "description": "Framework for secure open API access to financial data",
    "key_concepts": [
        "API-first access to financial data",
        "Standardized data schemas",
        "OAuth2-based authentication",
        "Regulated third-party access",
    ],
    "common_endpoints": [
        "/accounts",
        "/accounts/{id}",
        "/accounts/{id}/transactions",
        "/accounts/{id}/balances",
        "/customers",
        "/customers/{id}",
        "/payments",
        "/transfers",
    ],
    "field_mappings": {
        "customer_id": ["customerId", "customer_id", "userId", "user_id"],
        "account_number": ["accountNumber", "account_number", "iban", "bban"],
        "transaction_date": [
            "transactionDate",
            "transaction_date",
            "date",
            "valueDate",
        ],
        "amount": ["amount", "transactionAmount", "value"],
        "currency": ["currency", "currencyCode"],
    },
}

# =========== Common Integration Patterns ===========

PAYMENT_TO_LEDGER_PATTERN = {
    "pattern_name": "Payment Processor to Ledger",
    "description": "Sync payment transactions from Stripe/PayPal to accounting ledger",
    "source_api": "stripe",
    "dest_api": "accounting_system",
    "key_mappings": [
        {
            "source_field": "amount",
            "dest_field": "debit_amount",
            "transformation": "divide_by_100",  # Stripe stores in cents
        },
        {
            "source_field": "currency",
            "dest_field": "currency_code",
            "transformation": "uppercase",
        },
        {
            "source_field": "created",
            "dest_field": "transaction_date",
            "transformation": "unix_timestamp_to_iso8601",
        },
    ],
    "complexity_score": 45,
    "success_rate": 0.98,
}

BANK_TO_CASH_MANAGEMENT_PATTERN = {
    "pattern_name": "Bank Data to Cash Management",
    "description": "Aggregate bank account data from multiple banks to central system",
    "source_apis": ["plaid", "yodlee"],
    "dest_api": "cash_management_system",
    "key_mappings": [
        {
            "source_field": "balance",
            "dest_field": "available_balance",
            "transformation": "direct",
        },
        {
            "source_field": "account_number.mask",
            "dest_field": "last_four_digits",
            "transformation": "substring",
        },
    ],
    "complexity_score": 72,
    "success_rate": 0.95,
}

TRANSACTION_ENRICHMENT_PATTERN = {
    "pattern_name": "Transaction Enrichment",
    "description": "Enrich transactions with merchant category and risk data",
    "source_api": "payment_processor",
    "enrichment_services": ["merchant_database", "fraud_detection"],
    "key_fields_enriched": [
        "merchant_category_code",
        "merchant_name_standardized",
        "risk_score",
        "suspected_fraud",
    ],
    "complexity_score": 65,
}

# =========== Collection Organization ===========

FINANCIAL_KNOWLEDGE_BASE = {
    "apis": {
        "plaid": PLAID_API_KNOWLEDGE,
        "stripe": STRIPE_API_KNOWLEDGE,
        "yodlee": YODLEE_API_KNOWLEDGE,
    },
    "standards": {
        "psd2": PSD2_STANDARD,
        "fdx": FDX_STANDARD,
        "open_banking": OPEN_BANKING_STANDARD,
    },
    "patterns": {
        "payment_to_ledger": PAYMENT_TO_LEDGER_PATTERN,
        "bank_to_cash_management": BANK_TO_CASH_MANAGEMENT_PATTERN,
        "transaction_enrichment": TRANSACTION_ENRICHMENT_PATTERN,
    },
}


def get_financial_apis() -> Dict[str, Any]:
    """Get all financial API knowledge."""
    return FINANCIAL_KNOWLEDGE_BASE["apis"]


def get_financial_standards() -> Dict[str, Any]:
    """Get all financial standards."""
    return FINANCIAL_KNOWLEDGE_BASE["standards"]


def get_financial_patterns() -> Dict[str, Any]:
    """Get all financial integration patterns."""
    return FINANCIAL_KNOWLEDGE_BASE["patterns"]


def get_all_financial_knowledge() -> Dict[str, Any]:
    """Get complete financial knowledge base."""
    return FINANCIAL_KNOWLEDGE_BASE


# =========== Expanded API Ecosystem ===========

# Additional APIs from various categories for broader knowledge base

GITHUB_API_KNOWLEDGE = {
    "api_name": "GitHub API",
    "category": "developer_tools",
    "region": ["global"],
    "description": "GitHub repository and user management API",
    "doc_url": "https://docs.github.com/en/rest",
    "spec_url": "https://raw.githubusercontent.com/github/rest-api-description/main/descriptions/api.github.com/api.github.com.json",
    "base_url": "https://api.github.com",
    "authentication": {
        "type": "oauth2",
        "token_header": "Authorization",
        "token_prefix": "Bearer",
    },
    "endpoints": [
        {
            "path": "/repos/{owner}/{repo}",
            "method": "GET",
            "description": "Get repository information",
        },
        {
            "path": "/repos/{owner}/{repo}/issues",
            "method": "GET",
            "description": "List repository issues",
        },
    ],
}

SLACK_API_KNOWLEDGE = {
    "api_name": "Slack API",
    "category": "communication",
    "region": ["global"],
    "description": "Slack messaging and team collaboration API",
    "doc_url": "https://api.slack.com/",
    "base_url": "https://slack.com/api",
    "authentication": {
        "type": "oauth2",
        "token_header": "Authorization",
        "token_prefix": "Bearer",
    },
    "endpoints": [
        {
            "path": "/chat.postMessage",
            "method": "POST",
            "description": "Send a message to a channel",
        },
        {
            "path": "/conversations.list",
            "method": "GET",
            "description": "List conversations",
        },
    ],
}

TWILIO_API_KNOWLEDGE = {
    "api_name": "Twilio API",
    "category": "communication",
    "region": ["global"],
    "description": "SMS and voice communication API",
    "doc_url": "https://www.twilio.com/docs",
    "base_url": "https://api.twilio.com",
    "authentication": {
        "type": "basic",
        "username": "account_sid",
        "password": "auth_token",
    },
    "endpoints": [
        {
            "path": "/2010-04-01/Accounts/{AccountSid}/Messages.json",
            "method": "POST",
            "description": "Send SMS message",
        },
        {
            "path": "/2010-04-01/Accounts/{AccountSid}/Calls.json",
            "method": "POST",
            "description": "Make voice call",
        },
    ],
}

SHOPIFY_API_KNOWLEDGE = {
    "api_name": "Shopify Admin API",
    "category": "ecommerce",
    "region": ["global"],
    "description": "E-commerce store management API",
    "doc_url": "https://shopify.dev/docs/api",
    "base_url": "https://{store}.myshopify.com/admin/api/{version}",
    "authentication": {
        "type": "oauth2",
        "token_header": "X-Shopify-Access-Token",
    },
    "endpoints": [
        {
            "path": "/products.json",
            "method": "GET",
            "description": "List products",
        },
        {
            "path": "/orders.json",
            "method": "GET",
            "description": "List orders",
        },
    ],
}

HUBSPOT_API_KNOWLEDGE = {
    "api_name": "HubSpot CRM API",
    "category": "crm",
    "region": ["global"],
    "description": "Customer relationship management API",
    "doc_url": "https://developers.hubspot.com/docs/api/",
    "base_url": "https://api.hubapi.com",
    "authentication": {
        "type": "oauth2",
        "token_header": "Authorization",
        "token_prefix": "Bearer",
    },
    "endpoints": [
        {
            "path": "/crm/v3/objects/contacts",
            "method": "GET",
            "description": "Get contacts",
        },
        {
            "path": "/crm/v3/objects/deals",
            "method": "GET",
            "description": "Get deals",
        },
    ],
}


# Expanded knowledge base including additional APIs
EXPANDED_API_KNOWLEDGE = [
    PLAID_API_KNOWLEDGE,
    STRIPE_API_KNOWLEDGE,
    YODLEE_API_KNOWLEDGE,
    GITHUB_API_KNOWLEDGE,
    SLACK_API_KNOWLEDGE,
    TWILIO_API_KNOWLEDGE,
    SHOPIFY_API_KNOWLEDGE,
    HUBSPOT_API_KNOWLEDGE,
]
