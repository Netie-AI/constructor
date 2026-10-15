import pytest

pytest.importorskip("fastapi")

from fastapi import FastAPI  # noqa: E402
from starlette.testclient import TestClient  # noqa: E402

from netiegraph.context.context_graph import ContextGraph  # noqa: E402
from netiegraph.explorer.runtime import install_mutation_bridge  # noqa: E402
from netiegraph.explorer.session import GraphSession  # noqa: E402


def test_mutation_bridge_supports_multiple_apps_for_one_graph(monkeypatch):
    graph = ContextGraph(advanced_analytics=False)
    first_session = GraphSession(graph)
    second_session = GraphSession(graph)
    received = []
    graph.mutation_callback = lambda *event: received.append(("original", event))

    monkeypatch.setattr(
        first_session,
        "handle_graph_mutation",
        lambda *event: received.append(("first", event)),
    )
    monkeypatch.setattr(
        second_session,
        "handle_graph_mutation",
        lambda *event: received.append(("second", event)),
    )

    first_app = FastAPI()
    first_app.state.event_loop = None
    first_app.state.ws_manager = None
    second_app = FastAPI()
    second_app.state.event_loop = None
    second_app.state.ws_manager = None

    install_mutation_bridge(first_app, first_session)
    install_mutation_bridge(second_app, second_session)
    graph.mutation_callback("UPDATE_NODE", "node-1", {"content": "Updated"})

    assert [receiver for receiver, _ in received] == ["second", "first", "original"]


def test_mutation_bridge_is_idempotent_for_one_app(monkeypatch):
    graph = ContextGraph(advanced_analytics=False)
    session = GraphSession(graph)
    received = []
    monkeypatch.setattr(
        session,
        "handle_graph_mutation",
        lambda *event: received.append(event),
    )
    app = FastAPI()
    app.state.event_loop = None
    app.state.ws_manager = None

    install_mutation_bridge(app, session)
    install_mutation_bridge(app, session)
    graph.mutation_callback("UPDATE_NODE", "node-1", {"content": "Updated"})

    assert len(received) == 1


def test_mutation_bridge_reinstalls_for_new_session_on_same_app(monkeypatch):
    first_session = GraphSession(ContextGraph(advanced_analytics=False))
    second_session = GraphSession(ContextGraph(advanced_analytics=False))
    received = []
    monkeypatch.setattr(
        first_session,
        "handle_graph_mutation",
        lambda *event: received.append(("first", event)),
    )
    monkeypatch.setattr(
        second_session,
        "handle_graph_mutation",
        lambda *event: received.append(("second", event)),
    )
    app = FastAPI()
    app.state.event_loop = None
    app.state.ws_manager = None

    install_mutation_bridge(app, first_session)
    install_mutation_bridge(app, second_session)
    second_session.graph.mutation_callback(
        "UPDATE_NODE",
        "node-2",
        {"content": "Updated"},
    )

    assert [receiver for receiver, _ in received] == ["second"]


def test_legacy_server_mounts_editable_markdown_routes(monkeypatch):
    monkeypatch.setenv("NETIE_GRAPH_ALLOW_ANONYMOUS", "true")

    from netiegraph import server

    # Ask the routes whether they match, instead of reading ``route.path``:
    # FastAPI 0.141 mounts included routers lazily (``_IncludedRouter``),
    # which has no ``path``.
    from starlette.routing import Match

    def first_match(path, kind="http"):
        scope = {"type": kind, "path": path, "root_path": "", "method": "GET",
                 "headers": [], "query_string": b""}
        for route in server.app.router.routes:
            if route.matches(scope)[0] == Match.FULL:
                return route
        return None

    def is_spa_fallback(route):
        return getattr(route, "path", None) == "/{full_path:path}"

    # The real routes claim these paths before the SPA catch-all does.
    for path in ("/api/markdown/note/some/resource-id", "/api/memories"):
        route = first_match(path)
        assert route is not None and not is_spa_fallback(route), path
    assert getattr(first_match("/ws/graph-updates", kind="websocket"), "path", None) == "/ws/graph-updates"
    # And an unknown path does fall through to the SPA, so the check can fail.
    assert is_spa_fallback(first_match("/api/definitely-not-a-route"))

    with TestClient(server.app) as client:
        with client.websocket_connect("/ws/graph-updates") as websocket:
            acknowledgement = websocket.receive_json()
            assert acknowledgement["event"] == "connection_ack"
            assert acknowledgement["data"] == {"connected": True}
            assert acknowledgement["timestamp"]
        info = client.get("/api/info")
        memories = client.get("/api/memories")
        server.app.state.session.graph.add_node(
            "server-node",
            "Note",
            "Original server content",
        )
        current = client.get("/api/markdown/context-node/server-node").json()
        saved = client.put(
            "/api/markdown/context-node/server-node",
            json={
                "markdown": current["source"].replace(
                    "Original server content",
                    "Updated server content",
                ),
                "expected_revision": current["revision"],
            },
        )

    assert info.json()["capabilities"]["agent_memory"] is False
    assert memories.status_code == 503
    assert memories.json()["detail"] == (
        "AgentMemory is not configured for this Explorer instance."
    )
    assert saved.status_code == 200
    assert saved.json()["body"] == "Updated server content"
