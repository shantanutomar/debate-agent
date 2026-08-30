"""
Mock Web Search Tool
====================
In a real agentic app, this would call Tavily, SerpAPI, or Bing.
For now it returns believable-looking results so we can focus on
the tool-calling mechanics without needing an extra API key.

To upgrade: replace `mock_search` with a real HTTP call and keep
the SEARCH_TOOL schema exactly as-is — the agent code won't change.
"""

import json

# ── OpenAI Tool Schema ────────────────────────────────────────────────────────
# This JSON object is what you pass to OpenAI's `tools` parameter.
# It tells the model: "you can call a function named search_web,
# it expects a single string argument called 'query'."
SEARCH_TOOL = {
    "type": "function",
    "function": {
        "name": "search_web",
        "description": (
            "Search the web for facts, statistics, and expert opinions to support "
            "your argument. Use specific, targeted queries for best results."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The specific question or claim to search for",
                }
            },
            "required": ["query"],
        },
    },
}


def mock_search(query: str) -> str:
    """
    Simulates a web search. Returns JSON-encoded list of results.

    The model will receive this string as the tool's output and use it
    to inform its next response. Keeping it JSON means the model can
    parse and cite individual sources.

    Swap this body for a real API call when ready:
        import httpx
        r = httpx.get("https://api.tavily.com/search", params={"query": query, "api_key": ...})
        return r.text
    """
    results = [
        {
            "title": f"Study: {query}",
            "url": "https://academic.example.com/study",
            "source": "Journal of Technology Research, 2024",
            "snippet": (
                f"A meta-analysis of 47 peer-reviewed studies found that {query.lower()} "
                "has measurable and statistically significant effects. Researchers observed "
                "a 34% efficiency improvement in controlled environments (p < 0.01)."
            ),
        },
        {
            "title": f"Industry Survey: {query}",
            "url": "https://reports.example.com/survey",
            "source": "Gartner Research, Q3 2024",
            "snippet": (
                f"In a survey of 1,200 senior engineering leaders, 68% ranked "
                f"{query.lower()} as a top-three organizational priority. "
                "Early adopters report 2.3x faster time-to-market compared to laggards."
            ),
        },
        {
            "title": f"Expert Analysis: {query}",
            "url": "https://techblog.example.com/analysis",
            "source": "IEEE Spectrum",
            "snippet": (
                f"Leading practitioners argue that {query.lower()} fundamentally shifts "
                "how teams approach system design. The evidence suggests context matters: "
                "high-traffic systems benefit most, while smaller teams see diminishing returns."
            ),
        },
    ]

    return json.dumps(results, indent=2)
