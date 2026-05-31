export async function postJson<TResponse>(url: string, body: unknown, headers: Record<string, string> = {}): Promise<TResponse> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    body: JSON.stringify(body),
    cache: 'no-store'
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Webhook request failed with ${response.status}: ${errorText}`);
  }

  return (await response.json()) as TResponse;
}

export async function postFormData<TResponse>(url: string, body: FormData, headers: Record<string, string> = {}): Promise<TResponse> {
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body,
    cache: 'no-store'
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Webhook request failed with ${response.status}: ${errorText}`);
  }

  return (await response.json()) as TResponse;
}
