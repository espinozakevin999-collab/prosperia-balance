export function mergeCloudTransactions(localTransactions, remoteTransactions) {
  const remote = remoteTransactions || [];
  const remoteIds = new Set(remote.map((item) => item.id));
  const localOnly = (localTransactions || []).filter((item) => !remoteIds.has(item.id));

  return {
    merged: [...remote, ...localOnly],
    pendingUpload: localOnly,
  };
}
