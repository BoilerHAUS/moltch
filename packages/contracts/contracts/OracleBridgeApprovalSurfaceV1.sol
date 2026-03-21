// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title OracleBridgeApprovalSurfaceV1
/// @notice First executable on-chain prototype for the oracle-bridge approval seam.
/// @dev Keeps scope intentionally narrow for the first mergeable slice: deterministic bridge-request
///      lifecycle transitions, canonical linkage fields, stable events, and explicit invalid-edge rejection.
contract OracleBridgeApprovalSurfaceV1 {
    enum BridgeState {
        None,
        Requested,
        ApprovalPending,
        Approved,
        Denied,
        Executing,
        Executed,
        ExecutionFailed,
        TimedOut,
        Reconciled
    }

    struct BridgeRecord {
        bytes32 bridgeRequestId;
        bytes32 correlationId;
        bytes32 decisionId;
        bytes32 approvalId;
        bytes32 executionId;
        bytes32 actor;
        bytes32 reasonCode;
        BridgeState state;
        bool exists;
    }

    mapping(bytes32 => BridgeRecord) private _records;
    mapping(bytes32 => bool) private _seenExecutionIds;

    event BridgeRequested(
        bytes32 indexed bridgeRequestId,
        bytes32 indexed correlationId,
        bytes32 indexed decisionId,
        bytes32 actor
    );
    event BridgeApprovalRecorded(
        bytes32 indexed bridgeRequestId,
        bytes32 indexed approvalId,
        BridgeState nextState,
        bytes32 reasonCode,
        bytes32 actor
    );
    event BridgeExecutionRecorded(
        bytes32 indexed bridgeRequestId,
        bytes32 indexed executionId,
        BridgeState nextState,
        bytes32 reasonCode,
        bytes32 actor
    );

    error ErrRequiredFieldMissing();
    error ErrBridgeRequestAlreadyExists();
    error ErrBridgeRequestNotFound();
    error ErrExecutionAlreadyRecorded();
    error ErrInvalidBridgeTransition(BridgeState currentState, BridgeState requestedState);

    function submitBridgeRequest(bytes32 bridgeRequestId, bytes32 correlationId, bytes32 decisionId, bytes32 actor) external {
        if (bridgeRequestId == bytes32(0) || correlationId == bytes32(0) || decisionId == bytes32(0) || actor == bytes32(0)) {
            revert ErrRequiredFieldMissing();
        }
        if (_records[bridgeRequestId].exists) {
            revert ErrBridgeRequestAlreadyExists();
        }

        _records[bridgeRequestId] = BridgeRecord({
            bridgeRequestId: bridgeRequestId,
            correlationId: correlationId,
            decisionId: decisionId,
            approvalId: bytes32(0),
            executionId: bytes32(0),
            actor: actor,
            reasonCode: bytes32(0),
            state: BridgeState.Requested,
            exists: true
        });

        emit BridgeRequested(bridgeRequestId, correlationId, decisionId, actor);
    }

    function recordApprovalPending(bytes32 bridgeRequestId, bytes32 actor) external {
        BridgeRecord storage record = _mustGetRecord(bridgeRequestId);
        _requireNonZero(actor);
        _transition(record, BridgeState.ApprovalPending);
        record.actor = actor;
        emit BridgeApprovalRecorded(bridgeRequestId, bytes32(0), BridgeState.ApprovalPending, bytes32(0), actor);
    }

    function recordApprovalDecision(
        bytes32 bridgeRequestId,
        bytes32 approvalId,
        bytes32 reasonCode,
        bytes32 actor,
        BridgeState nextState
    ) external {
        BridgeRecord storage record = _mustGetRecord(bridgeRequestId);
        _requireNonZero(approvalId, reasonCode, actor);
        if (!(nextState == BridgeState.Approved || nextState == BridgeState.Denied)) {
            revert ErrInvalidBridgeTransition(record.state, nextState);
        }
        _transition(record, nextState);
        record.approvalId = approvalId;
        record.reasonCode = reasonCode;
        record.actor = actor;
        emit BridgeApprovalRecorded(bridgeRequestId, approvalId, nextState, reasonCode, actor);
    }

    function beginExecution(bytes32 bridgeRequestId, bytes32 actor) external {
        BridgeRecord storage record = _mustGetRecord(bridgeRequestId);
        _requireNonZero(actor);
        _transition(record, BridgeState.Executing);
        record.actor = actor;
        emit BridgeExecutionRecorded(bridgeRequestId, bytes32(0), BridgeState.Executing, bytes32(0), actor);
    }

    function recordExecutionOutcome(
        bytes32 bridgeRequestId,
        bytes32 executionId,
        bytes32 reasonCode,
        bytes32 actor,
        BridgeState nextState
    ) external {
        BridgeRecord storage record = _mustGetRecord(bridgeRequestId);
        _requireNonZero(executionId, reasonCode, actor);
        if (!(nextState == BridgeState.Executed || nextState == BridgeState.ExecutionFailed)) {
            revert ErrInvalidBridgeTransition(record.state, nextState);
        }
        if (_seenExecutionIds[executionId]) {
            revert ErrExecutionAlreadyRecorded();
        }
        _transition(record, nextState);
        _seenExecutionIds[executionId] = true;
        record.executionId = executionId;
        record.reasonCode = reasonCode;
        record.actor = actor;
        emit BridgeExecutionRecorded(bridgeRequestId, executionId, nextState, reasonCode, actor);
    }

    function getBridgeRecord(bytes32 bridgeRequestId) external view returns (BridgeRecord memory) {
        return _mustGetRecordMemory(bridgeRequestId);
    }

    function _transition(BridgeRecord storage record, BridgeState nextState) private {
        BridgeState current = record.state;
        bool valid =
            (current == BridgeState.Requested && nextState == BridgeState.ApprovalPending) ||
            (current == BridgeState.ApprovalPending && (nextState == BridgeState.Approved || nextState == BridgeState.Denied)) ||
            (current == BridgeState.Approved && nextState == BridgeState.Executing) ||
            (current == BridgeState.Executing && (nextState == BridgeState.Executed || nextState == BridgeState.ExecutionFailed));

        if (!valid) {
            revert ErrInvalidBridgeTransition(current, nextState);
        }
        record.state = nextState;
    }

    function _mustGetRecord(bytes32 bridgeRequestId) private view returns (BridgeRecord storage) {
        BridgeRecord storage record = _records[bridgeRequestId];
        if (!record.exists) {
            revert ErrBridgeRequestNotFound();
        }
        return record;
    }

    function _mustGetRecordMemory(bytes32 bridgeRequestId) private view returns (BridgeRecord memory) {
        BridgeRecord memory record = _records[bridgeRequestId];
        if (!record.exists) {
            revert ErrBridgeRequestNotFound();
        }
        return record;
    }

    function _requireNonZero(bytes32 a) private pure {
        if (a == bytes32(0)) {
            revert ErrRequiredFieldMissing();
        }
    }

    function _requireNonZero(bytes32 a, bytes32 b, bytes32 c) private pure {
        if (a == bytes32(0) || b == bytes32(0) || c == bytes32(0)) {
            revert ErrRequiredFieldMissing();
        }
    }
}
