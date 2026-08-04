from typing import Optional
from .utils import serialize_doc

def _serialize_guild(g: dict, my_role: Optional[str] = None) -> dict:
    out = serialize_doc(g)
    if my_role is not None:
        out["my_role"] = my_role
    return out
