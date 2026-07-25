/**
 * Fund the agent wallet with native USDC on Injective EVM testnet via
 * Circle CCTP v2: burn USDC on Ethereum Sepolia → attestation → mint on
 * Injective testnet.
 *
 *   pnpm cctp --dry-run          print the full step plan, send nothing
 *   pnpm cctp [--amount 1.5]     run the real flow (needs AGENT_PRIVATE_KEY
 *                                holding Sepolia USDC + Sepolia ETH for gas)
 *
 * Docs followed:
 *   https://developers.circle.com/stablecoins/cctp-getting-started
 *   Contract addresses/domains verified against @circle-fin/provider-cctp-v2.
 */
import { http, createPublicClient, createWalletClient, erc20Abi, formatUnits, parseAbi, parseUnits, pad } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

// --- CCTP v2 constants (testnet) ---
const SEPOLIA_USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238" as const;
const TOKEN_MESSENGER_V2 = "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA" as const; // same on Sepolia + Injective testnet
const MESSAGE_TRANSMITTER_V2 = "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275" as const;
const INJECTIVE_USDC = "0x0C382e685bbeeFE5d3d9C29e29E341fEE8E84C5d" as const;
const SEPOLIA_DOMAIN = 0;
const INJECTIVE_DOMAIN = 29;
const IRIS_API = "https://iris-api-sandbox.circle.com/v2/messages";
const INJECTIVE_TESTNET_RPC = process.env.INJECTIVE_EVM_RPC ?? "https://k8s.testnet.json-rpc.injective.network";
const SEPOLIA_RPC = process.env.SEPOLIA_RPC ?? "https://ethereum-sepolia-rpc.publicnode.com";
// Standard transfer: no fee, hard finality. (Fast transfers need maxFee > 0.)
const MAX_FEE = 0n;
const MIN_FINALITY_THRESHOLD = 2000;

const tokenMessengerAbi = parseAbi([
  "function depositForBurn(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient, address burnToken, bytes32 destinationCaller, uint256 maxFee, uint32 minFinalityThreshold)",
]);
const messageTransmitterAbi = parseAbi([
  "function receiveMessage(bytes message, bytes attestation) returns (bool)",
]);

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const amountArg = args[args.indexOf("--amount") + 1];
const amountUsdc = args.includes("--amount") && amountArg ? amountArg : "1";
const amount = parseUnits(amountUsdc, 6);

function step(n: number, msg: string): void {
  console.log(`\n[step ${n}] ${msg}`);
}

function plan(recipient: string): void {
  console.log("CCTP v2 funding plan: Sepolia USDC → native USDC on Injective EVM testnet");
  console.log(`  amount    : ${amountUsdc} USDC (${amount} units)`);
  console.log(`  recipient : ${recipient} (on Injective testnet, chain 1439)`);
  step(1, `approve(TokenMessengerV2 ${TOKEN_MESSENGER_V2}, ${amount}) on Sepolia USDC ${SEPOLIA_USDC}`);
  step(2, `depositForBurn(${amount}, destinationDomain=${INJECTIVE_DOMAIN}, mintRecipient=bytes32(${recipient}), burnToken=${SEPOLIA_USDC}, destinationCaller=0x0, maxFee=${MAX_FEE}, minFinalityThreshold=${MIN_FINALITY_THRESHOLD}) on TokenMessengerV2 — burns USDC on Sepolia`);
  step(3, `poll ${IRIS_API}/${SEPOLIA_DOMAIN}?transactionHash=<burnTx> until Circle attests the burn (typically 10–20 min for standard finality)`);
  step(4, `receiveMessage(message, attestation) on MessageTransmitterV2 ${MESSAGE_TRANSMITTER_V2} on Injective testnet — mints native USDC ${INJECTIVE_USDC} to the recipient (needs INJ for gas: https://testnet.faucet.injective.network)`);
  step(5, "verify: get_wallet_status MCP tool (or any explorer) shows the USDC balance — the agent can now pay x402 endpoints");
}

async function main(): Promise<void> {
  const key = process.env.AGENT_PRIVATE_KEY as `0x${string}` | undefined;

  if (dryRun) {
    plan(key ? privateKeyToAccount(key).address : "<AGENT_PRIVATE_KEY address>");
    console.log("\n--dry-run: no transactions sent. ✔");
    return;
  }

  if (!key) throw new Error("AGENT_PRIVATE_KEY is required (or use --dry-run). It must hold Sepolia USDC + ETH.");
  const account = privateKeyToAccount(key);
  const recipient = (process.env.RECIPIENT_ADDRESS ?? account.address) as `0x${string}`;
  plan(recipient);

  const sepoliaPublic = createPublicClient({ chain: sepolia, transport: http(SEPOLIA_RPC) });
  const sepoliaWallet = createWalletClient({ account, chain: sepolia, transport: http(SEPOLIA_RPC) });

  const balance = await sepoliaPublic.readContract({ address: SEPOLIA_USDC, abi: erc20Abi, functionName: "balanceOf", args: [account.address] });
  console.log(`\nSepolia USDC balance of ${account.address}: ${formatUnits(balance, 6)} USDC`);
  if (balance < amount) throw new Error(`Insufficient Sepolia USDC — need ${amountUsdc}. Faucet: https://faucet.circle.com`);

  step(1, "approving TokenMessengerV2…");
  const approveTx = await sepoliaWallet.writeContract({ address: SEPOLIA_USDC, abi: erc20Abi, functionName: "approve", args: [TOKEN_MESSENGER_V2, amount] });
  await sepoliaPublic.waitForTransactionReceipt({ hash: approveTx });
  console.log(`  approve tx: https://sepolia.etherscan.io/tx/${approveTx}`);

  step(2, "depositForBurn — burning USDC on Sepolia…");
  const mintRecipient = pad(recipient, { size: 32 });
  const burnTx = await sepoliaWallet.writeContract({
    address: TOKEN_MESSENGER_V2,
    abi: tokenMessengerAbi,
    functionName: "depositForBurn",
    args: [amount, INJECTIVE_DOMAIN, mintRecipient, SEPOLIA_USDC, pad("0x0", { size: 32 }), MAX_FEE, MIN_FINALITY_THRESHOLD],
  });
  await sepoliaPublic.waitForTransactionReceipt({ hash: burnTx });
  console.log(`  burn tx: https://sepolia.etherscan.io/tx/${burnTx}`);

  step(3, "polling Circle for the attestation (standard finality can take ~10–20 min)…");
  let message: { message: `0x${string}`; attestation: `0x${string}` } | undefined;
  for (let attempt = 1; !message; attempt++) {
    const res = await fetch(`${IRIS_API}/${SEPOLIA_DOMAIN}?transactionHash=${burnTx}`);
    if (res.ok) {
      const body = (await res.json()) as { messages?: Array<{ message: `0x${string}`; attestation: `0x${string}`; status: string }> };
      const msg = body.messages?.[0];
      if (msg?.status === "complete") {
        message = { message: msg.message, attestation: msg.attestation };
        break;
      }
      console.log(`  attempt ${attempt}: status=${msg?.status ?? "pending"} — retrying in 15s`);
    } else {
      console.log(`  attempt ${attempt}: attestation API ${res.status} — retrying in 15s`);
    }
    await new Promise((r) => setTimeout(r, 15_000));
  }
  console.log("  attestation received ✔");

  step(4, "receiveMessage on Injective testnet — minting native USDC…");
  const injectiveChain = {
    id: 1439,
    name: "Injective EVM Testnet",
    nativeCurrency: { name: "Injective", symbol: "INJ", decimals: 18 },
    rpcUrls: { default: { http: [INJECTIVE_TESTNET_RPC] } },
  } as const;
  const injPublic = createPublicClient({ chain: injectiveChain, transport: http(INJECTIVE_TESTNET_RPC) });
  const injWallet = createWalletClient({ account, chain: injectiveChain, transport: http(INJECTIVE_TESTNET_RPC) });
  const mintTx = await injWallet.writeContract({
    address: MESSAGE_TRANSMITTER_V2,
    abi: messageTransmitterAbi,
    functionName: "receiveMessage",
    args: [message.message, message.attestation],
  });
  await injPublic.waitForTransactionReceipt({ hash: mintTx });
  console.log(`  mint tx: https://testnet.blockscout.injective.network/tx/${mintTx}`);

  step(5, "verifying USDC balance on Injective testnet…");
  const usdcBalance = await injPublic.readContract({ address: INJECTIVE_USDC, abi: erc20Abi, functionName: "balanceOf", args: [recipient] });
  console.log(`  ${recipient} now holds ${formatUnits(usdcBalance, 6)} USDC on Injective EVM testnet ✔`);
  console.log("\nDone — the agent wallet can now pay x402 premium endpoints.");
}

main().catch((err) => {
  console.error(`\n[fund-wallet-cctp] FAILED: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
