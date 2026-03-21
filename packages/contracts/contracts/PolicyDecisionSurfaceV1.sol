// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title PolicyDecisionSurfaceV1
/// @notice First executable on-chain prototype for the moltch policy-decision seam.
/// @dev Keeps responsibility intentionally narrow: deterministic request -> evaluate -> record lifecycle,
///      stable emitted events, and explicit rejection of invalid transitions. Policy authoring stays off-chain.
contract PolicyDecisionSurfaceV1 {
    enum LifecycleState {
        None,
        Requested,
        Evaluating,
        Go,
        Hold,
        NoGo,
        Recorded
    }

    struct DecisionRecord {
        bytes32 requestDigest;
        bytes32 decisionId;
        bytes32 correlationId;
        bytes32 reasonCode;
        bytes32 actor;
        LifecycleState state;
        bool exists;
    }

    mapping(bytes32 => DecisionRecord) private _records;

    event DecisionRequested(bytes32 indexed decisionId, bytes32 indexed correlationId, bytes32 requestDigest, bytes32 actor);
    event DecisionEvaluated(bytes32 indexed decisionId, bytes32 indexed correlationId, LifecycleState nextState, bytes32 reasonCode, bytes32 actor);
    event DecisionRecorded(bytes32 indexed decisionId, bytes32 indexed correlationId, LifecycleState finalState);

    error ErrRequiredFieldMissing();
    error ErrDecisionAlreadyExists();
    error ErrDecisionNotFound();
    error ErrInvalidTransition(LifecycleState currentState, LifecycleState requestedState);

    function requestDecision(bytes32 decisionId, bytes32 correlationId, bytes32 requestDigest, bytes32 actor) external {
        if (decisionId == bytes32(0) || correlationId == bytes32(0) || requestDigest == bytes32(0) || actor == bytes32(0)) {
            revert ErrRequiredFieldMissing();
        }
        if (_records[decisionId].exists) {
            revert ErrDecisionAlreadyExists();
        }

        _records[decisionId] = DecisionRecord({
            requestDigest: requestDigest,
            decisionId: decisionId,
            correlationId: correlationId,
            reasonCode: bytes32(0),
            actor: actor,
            state: LifecycleState.Requested,
            exists: true
        });

        emit DecisionRequested(decisionId, correlationId, requestDigest, actor);
    }

    function evaluateDecision(bytes32 decisionId, bytes32 reasonCode, bytes32 actor, LifecycleState nextState) external {
        DecisionRecord storage record = _records[decisionId];
        if (!record.exists) {
            revert ErrDecisionNotFound();
        }
        if (reasonCode == bytes32(0) || actor == bytes32(0)) {
            revert ErrRequiredFieldMissing();
        }

        LifecycleState current = record.state;
        bool valid =
            (current == LifecycleState.Requested && nextState == LifecycleState.Evaluating) ||
            (current == LifecycleState.Evaluating && (nextState == LifecycleState.Go || nextState == LifecycleState.Hold || nextState == LifecycleState.NoGo)) ||
            ((current == LifecycleState.Go || current == LifecycleState.Hold || current == LifecycleState.NoGo) && nextState == LifecycleState.Recorded);

        if (!valid) {
            revert ErrInvalidTransition(current, nextState);
        }

        record.reasonCode = reasonCode;
        record.actor = actor;
        record.state = nextState;

        emit DecisionEvaluated(decisionId, record.correlationId, nextState, reasonCode, actor);

        if (nextState == LifecycleState.Recorded) {
            emit DecisionRecorded(decisionId, record.correlationId, nextState);
        }
    }

    function getDecision(bytes32 decisionId) external view returns (DecisionRecord memory) {
        DecisionRecord memory record = _records[decisionId];
        if (!record.exists) {
            revert ErrDecisionNotFound();
        }
        return record;
    }
}
