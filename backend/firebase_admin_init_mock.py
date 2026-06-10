import os
import sys
import json
import uuid
from datetime import datetime
from types import ModuleType

# ---------------------------------------------------------------------------
# Mock Firebase Classes
# ---------------------------------------------------------------------------

class MockArrayUnion:
    def __init__(self, values):
        self.values = values

class MockFirestoreModule(ModuleType):
    class Query:
        DESCENDING = "DESCENDING"
        ASCENDING = "ASCENDING"

    @staticmethod
    def ArrayUnion(values):
        return MockArrayUnion(values)

class MockDocumentSnapshot:
    def __init__(self, doc_id, data):
        self.id = doc_id
        self._data = data
        self.exists = data is not None

    def to_dict(self):
        return self._data

class MockDocumentReference:
    def __init__(self, store, col_name, doc_id):
        self.store = store
        self.col_name = col_name
        self.id = doc_id

    def collection(self, nested_col_name):
        return MockQuery(self.store, f"{self.col_name}/{self.id}/{nested_col_name}")

    def get(self):
        data = self.store._get_doc(self.col_name, self.id)
        return MockDocumentSnapshot(self.id, data)

    def set(self, data, merge=False):
        self.store._set_doc(self.col_name, self.id, data, merge)

    def update(self, data):
        self.store._update_doc(self.col_name, self.id, data)

    def delete(self):
        self.store._delete_doc(self.col_name, self.id)

class MockQuery:
    def __init__(self, store, col_name, filters=None, order_by_field=None, order_by_direction=None, limit_val=None):
        self.store = store
        self.col_name = col_name
        self.filters = filters or []
        self.order_by_field = order_by_field
        self.order_by_direction = order_by_direction
        self.limit_val = limit_val

    def document(self, doc_id=None):
        if not doc_id:
            doc_id = str(uuid.uuid4())
        return MockDocumentReference(self.store, self.col_name, doc_id)

    def collection(self, col_name):
        return MockQuery(self.store, f"{self.col_name}/{col_name}")

    def where(self, filter=None, field=None, op=None, value=None):
        new_filters = list(self.filters)
        if filter is not None:
            new_filters.append(filter)
        else:
            new_filters.append((field, op, value))
        return MockQuery(self.store, self.col_name, new_filters, self.order_by_field, self.order_by_direction, self.limit_val)

    def order_by(self, field, direction=None):
        return MockQuery(self.store, self.col_name, self.filters, field, direction, self.limit_val)

    def limit(self, limit_val):
        return MockQuery(self.store, self.col_name, self.filters, self.order_by_field, self.order_by_direction, limit_val)

    def get(self):
        docs = self.store._query_docs(self.col_name, self.filters, self.order_by_field, self.order_by_direction, self.limit_val)
        return [MockDocumentSnapshot(d["id"], d) for d in docs]

class MockFirestoreClient:
    def __init__(self, store):
        self.store = store

    def collection(self, col_name):
        return MockQuery(self.store, col_name)

    def document(self, doc_path):
        parts = doc_path.split("/")
        if len(parts) >= 2:
            col_name = parts[0]
            doc_id = parts[1]
            return MockDocumentReference(self.store, col_name, doc_id)
        raise ValueError("Invalid document path")

# ---------------------------------------------------------------------------
# Mock Database Store (JSON persistent)
# ---------------------------------------------------------------------------

class MockFirebaseStore:
    def __init__(self, file_path="backend/mock_db.json"):
        self.file_path = file_path
        self.files_dir = "backend/mock_storage"
        os.makedirs(os.path.dirname(self.file_path), exist_ok=True)
        os.makedirs(self.files_dir, exist_ok=True)
        self.data = self._load()

    def _load(self):
        if os.path.exists(self.file_path):
            try:
                with open(self.file_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
        
        # Default seeded data
        now_str = datetime.utcnow().isoformat()
        default_data = {
            "jobs": {
                "job-frontend": {
                    "id": "job-frontend",
                    "title": "Senior Frontend Engineer",
                    "department": "Engineering",
                    "requiredSkills": ["React", "TypeScript", "TailwindCSS"],
                    "requiredYears": 5,
                    "preferredDomains": ["SaaS", "FinTech"],
                    "criticalSkills": ["React", "TypeScript"],
                    "isActive": True,
                    "createdAt": now_str
                },
                "job-backend": {
                    "id": "job-backend",
                    "title": "Backend Architect",
                    "department": "Engineering",
                    "requiredSkills": ["Python", "FastAPI", "Firestore", "Gemini"],
                    "requiredYears": 8,
                    "preferredDomains": ["Cloud", "SaaS"],
                    "criticalSkills": ["Python", "FastAPI"],
                    "isActive": True,
                    "createdAt": now_str
                }
            },
            "candidates": {},
            "assessments": {},
            "hr_users": {
                "mock-hr-uid": {
                    "uid": "mock-hr-uid",
                    "email": "hr@company.com",
                    "role": "recruiter"
                }
            },
            "errors": {}
        }
        self._save(default_data)
        return default_data

    def _save(self, data=None):
        if data is None:
            data = self.data
        try:
            with open(self.file_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            print(f"Error saving mock db: {e}")

    def _get_doc(self, col, doc_id):
        return self.data.setdefault(col, {}).get(doc_id)

    def _set_doc(self, col, doc_id, doc_data, merge=False):
        col_data = self.data.setdefault(col, {})
        serializable_data = self._make_serializable(doc_data)
        if merge and doc_id in col_data:
            col_data[doc_id].update(serializable_data)
        else:
            col_data[doc_id] = serializable_data
        self._save()

    def _update_doc(self, col, doc_id, doc_data):
        col_data = self.data.setdefault(col, {})
        if doc_id not in col_data:
            col_data[doc_id] = {}
        for k, v in doc_data.items():
            v_type = type(v).__name__
            if v_type == 'MockArrayUnion' or v_type == 'ArrayUnion' or v_type.endswith('ArrayUnion'):
                existing = col_data[doc_id].setdefault(k, [])
                if not isinstance(existing, list):
                    existing = [existing]
                values = getattr(v, 'values', getattr(v, '_values', []))
                for item in values:
                    existing.append(self._make_serializable(item))
                col_data[doc_id][k] = existing
            else:
                col_data[doc_id][k] = self._make_serializable(v)
        self._save()

    def _delete_doc(self, col, doc_id):
        if doc_id in self.data.setdefault(col, {}):
            del self.data[col][doc_id]
            self._save()

    def _query_docs(self, col, filters, order_by_field, order_by_direction, limit_val):
        col_data = self.data.setdefault(col, {})
        results = []
        for doc_id, doc in col_data.items():
            doc_copy = dict(doc)
            doc_copy["id"] = doc_id
            match = True
            for filter_item in filters:
                if hasattr(filter_item, "field_path"):
                    field = filter_item.field_path
                    op = filter_item.op_string
                    value = filter_item.value
                elif isinstance(filter_item, tuple) and len(filter_item) == 3:
                    field, op, value = filter_item
                else:
                    continue
                
                doc_val = doc_copy.get(field)
                if op == "==":
                    if doc_val != value:
                        match = False
                elif op == ">=":
                    if doc_val is None or doc_val < value:
                        match = False
                elif op == "<=":
                    if doc_val is None or doc_val > value:
                        match = False
            if match:
                results.append(doc_copy)

        if order_by_field:
            reverse = (order_by_direction == "DESCENDING" or order_by_direction == -1)
            results.sort(key=lambda x: str(x.get(order_by_field, "")), reverse=reverse)

        if limit_val:
            results = results[:limit_val]
        return results

    def _make_serializable(self, obj):
        obj_type = type(obj).__name__
        if obj_type == 'MockArrayUnion' or obj_type == 'ArrayUnion' or obj_type.endswith('ArrayUnion'):
            values = getattr(obj, 'values', getattr(obj, '_values', []))
            return [self._make_serializable(v) for v in values]
        elif isinstance(obj, dict):
            return {k: self._make_serializable(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [self._make_serializable(v) for v in obj]
        elif isinstance(obj, datetime):
            return obj.isoformat()
        elif hasattr(obj, "isoformat"):
            return obj.isoformat()
        return obj

    def _save_file(self, storage_path, file_bytes):
        file_path = os.path.join(self.files_dir, storage_path.replace("/", "_"))
        with open(file_path, "wb") as f:
            f.write(file_bytes)

    def _get_file(self, storage_path):
        file_path = os.path.join(self.files_dir, storage_path.replace("/", "_"))
        if os.path.exists(file_path):
            with open(file_path, "rb") as f:
                return f.read()
        return b""

# ---------------------------------------------------------------------------
# Mock Storage Classes
# ---------------------------------------------------------------------------

class MockBlob:
    def __init__(self, bucket, storage_path):
        self.bucket = bucket
        self.storage_path = storage_path
        self.public_url = f"http://localhost:8000/api/mock/cv/{storage_path}"

    def upload_from_string(self, file_bytes, content_type=None):
        self.bucket.db_client._save_file(self.storage_path, file_bytes)

    def make_public(self):
        pass

    def generate_signed_url(self, expiration=None, method="GET"):
        return self.public_url

    def download_as_bytes(self):
        return self.bucket.db_client._get_file(self.storage_path)

class MockStorageBucket:
    def __init__(self, db_client):
        self.db_client = db_client

    def blob(self, storage_path):
        return MockBlob(self, storage_path)

# Initialize singletons
mock_store = MockFirebaseStore()
mock_db = MockFirestoreClient(mock_store)
mock_bucket = MockStorageBucket(mock_store)
mock_firestore_module = MockFirestoreModule('firestore')
