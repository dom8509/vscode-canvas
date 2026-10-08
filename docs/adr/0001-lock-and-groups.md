# 1. A moving group carries its locked cards

Status: accepted, 2026-10-08 ([Spec 0001](../specs/0001-usability-polish.md), _Decisions_)

## Context

A **lock** keeps a card, group or connection from being moved, resized,
turned, edited, restyled or deleted. A **group** moves the cards that lie
inside it. When an unlocked group holds a locked card, one of the two rules
has to give.

## Decision

Moving an unlocked group carries every card inside it, locked or not. A lock
protects an element from being dragged by itself; it does not pin it to the
paper. A locked group does not move, and neither do the cards in it unless
they are selected themselves.

## Consequences

- A group stays one unit: its cards never fall out of it because one is locked.
- To keep a card in place, lock the group around it as well.
- Two related rules from the same spec: a card with a locked connection cannot
  be deleted until the connection is unlocked, and a copy of a locked element
  is not locked.
