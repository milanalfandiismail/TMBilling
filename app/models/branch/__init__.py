# app/models/branch/__init__.py
from app.models.branch.branch import Branch
from app.models.branch.branch_inbound import BranchInbound

__all__ = ["Branch", "BranchInbound"]
