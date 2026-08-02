import start_quant_backend as backend


def test_deepseek_v4_flash_is_the_default_model():
    assert backend.DEEPSEEK_DEFAULT_MODEL == 'deepseek-v4-flash'
    assert backend.ai_provider_config_state['model'] == 'deepseek-v4-flash'


def test_retired_deepseek_models_migrate_to_v4_flash():
    for retired_model in ('deepseek-chat', 'deepseek-coder', 'deepseek-reasoner'):
        assert backend._normalize_ai_model('DeepSeek', retired_model) == 'deepseek-v4-flash'


def test_current_and_custom_models_are_preserved():
    assert backend._normalize_ai_model('DeepSeek', 'deepseek-v4-pro') == 'deepseek-v4-pro'
    assert backend._normalize_ai_model('Custom', 'deepseek-chat') == 'deepseek-chat'


def test_settings_get_exposes_v4_flash_for_retired_config(monkeypatch):
    monkeypatch.setattr(backend, 'supabase_admin', object())
    monkeypatch.setattr(backend, 'get_supabase_user', lambda: {'id': 'user-123', 'email': 'user@example.com'})
    monkeypatch.setattr(backend, 'get_user_config', lambda _uid, _kind: {
        'provider': 'DeepSeek',
        'model': 'deepseek-chat',
        'baseURL': 'https://api.deepseek.com',
        'apiKey': 'sk-valid-test-key',
    })

    with backend.app.test_client() as client:
        response = client.get(
            '/api/settings/ai-config',
            headers={'Authorization': 'Bearer test-token'},
        )

    assert response.status_code == 200
    assert response.get_json()['config']['model'] == 'deepseek-v4-flash'


def test_settings_save_persists_v4_flash_for_retired_config(monkeypatch):
    saved = {}
    monkeypatch.setattr(backend, 'supabase_admin', object())
    monkeypatch.setattr(backend, 'get_supabase_user', lambda: {'id': 'user-123', 'email': 'user@example.com'})
    monkeypatch.setattr(backend, 'get_user_config', lambda _uid, _kind: {
        'provider': 'DeepSeek',
        'model': 'deepseek-chat',
        'apiKey': 'sk-valid-test-key',
    })

    def capture_save(_uid, _kind, config):
        saved.update(config)
        return True, None

    monkeypatch.setattr(backend, 'save_user_config', capture_save)

    with backend.app.test_client() as client:
        response = client.post(
            '/api/settings/ai-config',
            headers={'Authorization': 'Bearer test-token'},
            json={'provider': 'DeepSeek', 'model': 'deepseek-chat'},
        )

    assert response.status_code == 200
    assert saved['model'] == 'deepseek-v4-flash'
