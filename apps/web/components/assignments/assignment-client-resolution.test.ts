import { test } from "node:test";
import assert from "node:assert/strict";

interface MockMachine {
  id: string;
  client_id?: string;
  client?: { id: string; company_name: string };
}

function resolveClientId(machine: MockMachine | null): string | undefined {
  return machine?.client_id || machine?.client?.id;
}

test("resolves client id from both flat client_id and joined client.id object", () => {
  const flatMachine: MockMachine = { id: "m-1", client_id: "client-abc" };
  assert.equal(resolveClientId(flatMachine), "client-abc");

  const joinedMachine: MockMachine = {
    id: "m-2",
    client: { id: "client-xyz", company_name: "L&T Construction" },
  };
  assert.equal(resolveClientId(joinedMachine), "client-xyz");

  const emptyMachine: MockMachine = { id: "m-3" };
  assert.equal(resolveClientId(emptyMachine), undefined);
});

test("simulates asynchronous machine resolution triggering client id transition", () => {
  let activeMachine: MockMachine | null = null;
  let resolvedClientId: string | undefined = resolveClientId(activeMachine);
  assert.equal(resolvedClientId, undefined);

  // Asynchronous load resolves machine with nested client object
  activeMachine = {
    id: "m-async",
    client: { id: "client-rebar", company_name: "Rebar Steel Site" },
  };
  resolvedClientId = resolveClientId(activeMachine);

  assert.equal(
    resolvedClientId,
    "client-rebar",
    "Client ID must resolve when machine resolves asynchronously"
  );
});
