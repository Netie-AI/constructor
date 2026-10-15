"""Suite-wide test isolation for Netie Graph.

No test may reach a model provider with a real key from the developer's or
the CI runner's environment. Several LLM tests read provider keys from the
environment (directly or through litellm) and, when one is set, make a live
call that spends that key. This fixture removes every ``*_API_KEY`` variable
for each test; a test that needs a key sets its own with ``monkeypatch``.
Tests marked ``integration`` (deselected by default) keep the environment,
since they exist to call real services.

The extraction layer also keeps a process-wide ``config`` singleton
(``netiegraph.semantic_extract.config``). It reads provider keys once, when the
package is first imported (at collection, before any fixture runs), and tests
that call ``config.set_provider(...)`` change it for every later test. Each test
therefore gets a fresh configuration, built after the keys are removed.

The progress tracker is another process-wide singleton: some tests switch it
off (``tracker.enabled = False``) or replace it, and later tests that expect
the default then fail depending on run order. Its state is saved before each
test and restored after.

Several test modules change ``os.environ`` when they are imported (for example
``NETIE_GRAPH_DISABLE_PROGRESS=1``, and importing ``netiegraph_mcp`` sets it
too). Import happens at collection, so the change used to hold for every test
collected after. Each module's import-time environment changes are recorded,
undone once the module is collected, and re-applied only around its own tests.
"""

from __future__ import annotations

import importlib
import os

import pytest

# Test module path -> (variables its import set, variables its import removed).
_MODULE_ENV: dict[str, tuple[dict[str, str], set[str]]] = {}


@pytest.hookimpl(hookwrapper=True)
def pytest_make_collect_report(collector: pytest.Collector):
    if not isinstance(collector, pytest.Module):
        yield
        return
    before = dict(os.environ)
    yield
    after = dict(os.environ)
    changed = {k: v for k, v in after.items() if before.get(k) != v}
    removed = {k for k in before if k not in after}
    if changed or removed:
        _MODULE_ENV[str(collector.path)] = (changed, removed)
        os.environ.clear()
        os.environ.update(before)


@pytest.fixture(autouse=True)
def _no_ambient_provider_keys(request: pytest.FixtureRequest, monkeypatch: pytest.MonkeyPatch) -> None:
    if request.node.get_closest_marker("integration") is not None:
        return
    for name in list(os.environ):
        if name.endswith("_API_KEY"):
            monkeypatch.delenv(name, raising=False)

    # The package re-exports the ``config`` instance under the submodule's name,
    # so import the submodule itself.
    config_module = importlib.import_module("netiegraph.semantic_extract.config")
    fresh = config_module.Config()
    monkeypatch.setattr(config_module.config, "_configs", fresh._configs)


@pytest.fixture(autouse=True)
def _module_import_env(request: pytest.FixtureRequest, monkeypatch: pytest.MonkeyPatch, _no_ambient_provider_keys: None) -> None:
    changed, removed = _MODULE_ENV.get(str(request.node.path), ({}, set()))
    for name, value in changed.items():
        monkeypatch.setenv(name, value)
    for name in removed:
        monkeypatch.delenv(name, raising=False)


@pytest.fixture(autouse=True)
def _restore_progress_tracker(monkeypatch: pytest.MonkeyPatch, _module_import_env: None) -> None:
    progress = importlib.import_module("netiegraph.utils.progress_tracker")
    tracker = progress.get_progress_tracker()
    monkeypatch.setattr(progress, "_global_tracker", progress._global_tracker)
    monkeypatch.setattr(progress.ProgressTracker, "_instance", progress.ProgressTracker._instance)
    monkeypatch.setattr(tracker, "_enabled", tracker._enabled)
    # The enable setter latches a one-time env disable; start each test from
    # the default (enabled), which the setter still refuses when this test's
    # own environment disables progress.
    monkeypatch.setattr(tracker, "_progress_forced_disabled", False)
    tracker.enabled = True
