import clientsJson from "@/data/mock/clients.json";
import { dataSource } from "@/lib/env";
import { sleep } from "@/lib/delay";
import { makeId } from "@/lib/id";
import type { Client, ClientInput } from "@/types/client";
import { NotFoundError, NotImplementedError } from "./_errors";

let mock: Client[] = JSON.parse(JSON.stringify(clientsJson)) as Client[];

export async function listClients(): Promise<Client[]> {
  if (dataSource !== "mock") throw new NotImplementedError("listClients");
  await sleep(60);
  return [...mock];
}

export async function getClient(id: string): Promise<Client | null> {
  if (dataSource !== "mock") throw new NotImplementedError("getClient");
  await sleep(40);
  return mock.find((c) => c.id === id) ?? null;
}

export async function createClient(input: ClientInput): Promise<Client> {
  if (dataSource !== "mock") throw new NotImplementedError("createClient");
  await sleep(120);
  const created: Client = {
    ...input,
    id: makeId("cli"),
    joinedISO: new Date().toISOString(),
  };
  mock = [created, ...mock];
  return created;
}

export async function updateClient(
  id: string,
  patch: Partial<ClientInput>,
): Promise<Client> {
  if (dataSource !== "mock") throw new NotImplementedError("updateClient");
  await sleep(100);
  const idx = mock.findIndex((c) => c.id === id);
  if (idx === -1) throw new NotFoundError("client", id);
  const next: Client = { ...mock[idx], ...patch };
  mock = [...mock.slice(0, idx), next, ...mock.slice(idx + 1)];
  return next;
}
