import inspect

import start_quant_backend as backend


def test_entry_plan_initializes_user_context_before_scale_in_lookup():
    source = inspect.getsource(backend.ai_entry_plan)

    assignment = source.index("entry_user_id =")
    scale_in_lookup = source.index("_pa_get_managed_position_plan(entry_user_id")

    assert assignment < scale_in_lookup
