"""Authenticate server-generated equity evidence, scoped to user/type/key.

Generic user artifact uploads are not research evidence. The signature also
rejects unsigned artifacts created through an older deployment's generic API.
"""
from copy import deepcopy
import hashlib
import hmac
import json

from operations_store import OperationsStoreUnavailable


class EquityAuthenticatedStore:
    def __init__(self, store, signing_key):
        self.store = store
        self.key = signing_key.encode() if isinstance(signing_key, str) else signing_key
        if not self.key:
            raise OperationsStoreUnavailable('Equity evidence signing key is unavailable')

    def _signature(self, uid, kind, key, payload):
        message = json.dumps([str(uid), str(kind).strip().lower(), str(key), payload],
                             sort_keys=True, separators=(',', ':'), allow_nan=False).encode()
        return hmac.new(self.key, message, hashlib.sha256).hexdigest()

    def _verify(self, uid, kind, key, row):
        if row is None:
            return None
        result = deepcopy(row)
        payload = result.get('payload') or {}
        proof = payload.pop('_serverAttestation', None)
        if not isinstance(proof, str) or not hmac.compare_digest(proof, self._signature(uid, kind, key, payload)):
            raise OperationsStoreUnavailable('Unverified equity evidence')
        result['payload'] = payload
        return result

    def get_artifact(self, uid, kind, key):
        return self._verify(uid, kind, key, self.store.get_artifact(uid, kind, key))

    def put_artifact(self, uid, kind, key, *, payload, idempotency_key, expected_version=None):
        body = deepcopy(payload)
        body.pop('_serverAttestation', None)
        body['_serverAttestation'] = self._signature(uid, kind, key, body)
        row = self.store.put_artifact(uid, kind, key, payload=body,
                                      idempotency_key=idempotency_key, expected_version=expected_version)
        return self._verify(uid, kind, key, row)
