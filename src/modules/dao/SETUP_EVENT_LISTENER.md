# Event Listener Setup Guide

This guide will walk you through setting up the blockchain event listener service for automatic DAO data synchronization.

## Prerequisites

1. Node.js v18+ installed
2. PostgreSQL database running
3. Deployed DAO smart contracts (Governor, Staking, Token)
4. RPC endpoint (Alchemy, Infura, or public RPC)

## Installation Steps

### 1. Install Dependencies

The required dependencies should already be in package.json. Run:

```bash
npm install
```

This will install:
- `viem` - For blockchain interactions
- Other existing dependencies

### 2. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.dao.example .env
```

Edit `.env` and add your configuration:

```bash
# Chain Configuration
CHAIN_ID=1  # 1 for mainnet, 11155111 for Sepolia
RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY
BLOCKCHAIN_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY

# Contract Addresses (replace with your deployed contract addresses)
GOVERNOR_CONTRACT_ADDRESS=0x1234567890123456789012345678901234567890
TOKEN_CONTRACT_ADDRESS=0x2345678901234567890123456789012345678901
STAKING_CONTRACT_ADDRESS=0x3456789012345678901234567890123456789012
TREASURY_ADDRESS=0x4567890123456789012345678901234567890123
GOVERNANCE_TOKEN_ADDRESS=0x2345678901234567890123456789012345678901

# Event Indexing
START_BLOCK=18500000  # Set to your contract deployment block
```

### 3. Update Database Schema

Ensure your Prisma schema is up to date:

```bash
npx prisma generate
npx prisma migrate dev
```

### 4. Start the Application

Start the NestJS application:

```bash
npm run start:dev
```

The event listener will automatically:
1. Index historical events from START_BLOCK to current block
2. Start real-time event monitoring
3. Sync all blockchain data to the database

## Verification

### Check Event Listener Status

```bash
curl http://localhost:3000/dao/listener/status
```

Expected response:
```json
{
  "isListening": true,
  "contracts": {
    "governor": "0x1234567890123456789012345678901234567890",
    "staking": "0x3456789012345678901234567890123456789012",
    "treasury": "0x4567890123456789012345678901234567890123"
  }
}
```

### Check Application Logs

Look for these log messages:

```
[EventListenerService] Starting historical event indexing...
[IndexerService] Indexing events from block 18500000 to 19500000
[IndexerService] Processing batch: 18500000 to 18510000 (10%)
...
[IndexerService] Historical event indexing completed
[EventListenerService] Event listeners started successfully
```

### Verify Data Sync

Check if proposals are being synced:

```bash
curl http://localhost:3000/dao/proposals
```

Check if votes are being synced:

```bash
curl http://localhost:3000/dao/votes/0xYourWalletAddress
```

## Configuration Options

### Adjust Batch Size

For faster indexing with a reliable RPC endpoint, increase the batch size in `indexer.service.ts`:

```typescript
private readonly BATCH_SIZE = 50000; // Default: 10000
```

For rate-limited RPC endpoints, decrease the batch size:

```typescript
private readonly BATCH_SIZE = 5000;
```

### Adjust Retry Logic

Modify retry settings in `indexer.service.ts`:

```typescript
private readonly MAX_RETRIES = 5;    // Default: 3
private readonly RETRY_DELAY = 3000; // Default: 2000ms
```

## Common Issues and Solutions

### Issue: Historical indexing is very slow

**Solution 1**: Set START_BLOCK to your contract deployment block
```bash
# Find deployment block from your deployment transaction
START_BLOCK=19000000
```

**Solution 2**: Use a dedicated RPC endpoint (Alchemy, Infura)
```bash
RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY
```

**Solution 3**: Reduce batch size to avoid timeouts
```typescript
private readonly BATCH_SIZE = 5000;
```

### Issue: RPC rate limiting errors

**Symptoms**: Logs show "Error fetching logs, retrying..."

**Solution 1**: Increase delay between batches in `indexer.service.ts`:
```typescript
await this.delay(1000); // Increase from 500ms to 1000ms
```

**Solution 2**: Upgrade your RPC plan for higher rate limits

**Solution 3**: Use a different RPC provider

### Issue: Duplicate events being processed

**Symptoms**: Console warnings about existing records

**Solution**: This is normal behavior. The system automatically skips duplicates. If you see excessive warnings, consider:
```bash
# Re-index from a specific block
curl -X POST "http://localhost:3000/dao/indexer/reindex?fromBlock=19000000"
```

### Issue: Missing events after indexing

**Symptoms**: Some proposals or votes are missing

**Solution 1**: Check if events match your contract ABI
- Verify event signatures in `event-listener.service.ts`
- Compare with your deployed contract events

**Solution 2**: Re-index from deployment block
```bash
curl -X POST "http://localhost:3000/dao/indexer/reindex?fromBlock=18500000"
```

### Issue: Event listener stopped unexpectedly

**Symptoms**: No new events being processed

**Solution 1**: Check logs for errors
```bash
grep "EventListenerService" logs/app.log
```

**Solution 2**: Manually restart the listener
```bash
curl -X POST http://localhost:3000/dao/listener/start
```

**Solution 3**: Restart the application
```bash
npm run start:dev
```

## Production Deployment

### 1. Use Environment-Specific Configuration

Create separate environment files:
```bash
.env.production
.env.staging
.env.development
```

### 2. Set Up Process Manager

Use PM2 for production:

```bash
npm install -g pm2
npm run build
pm2 start dist/main.js --name agent-guild-api
```

### 3. Configure Logging

Update NestJS logger configuration in `main.ts`:

```typescript
app.useLogger(['error', 'warn', 'log']); // Production
app.useLogger(['error', 'warn', 'log', 'debug']); // Development
```

### 4. Set Up Monitoring

Monitor event listener health:

```bash
# Health check endpoint
curl http://localhost:3000/dao/listener/status

# Set up alerting based on isListening status
```

### 5. Database Backups

Regular backups before re-indexing:

```bash
pg_dump -U postgres agent_guild_db > backup_$(date +%Y%m%d).sql
```

## Performance Optimization

### 1. Database Indexes

Ensure proper indexes exist (already configured in Prisma schema):
```prisma
@@index([proposer])
@@index([status])
@@index([blockNumber])
```

### 2. Connection Pooling

Configure database connection pool in `prisma/schema.prisma`:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  connection_limit = 20
}
```

### 3. RPC Endpoint

Use a dedicated RPC endpoint with high rate limits:
- Alchemy: https://www.alchemy.com/pricing
- Infura: https://www.infura.io/pricing
- QuickNode: https://www.quicknode.com/pricing

### 4. Caching

Consider implementing Redis caching for frequently accessed data:
```typescript
// Cache proposal data
@Cacheable('proposals', 300) // 5 minutes
async getProposal(id: string) { ... }
```

## Maintenance

### Regular Tasks

1. **Monitor disk space**: Event data grows over time
2. **Check RPC quota**: Ensure you're within limits
3. **Review error logs**: Identify recurring issues
4. **Update START_BLOCK**: After re-deployment

### Periodic Re-indexing

Re-index data monthly to ensure consistency:

```bash
# Stop listener
curl -X POST http://localhost:3000/dao/listener/stop

# Re-index from deployment block
curl -X POST "http://localhost:3000/dao/indexer/reindex?fromBlock=18500000"

# Start listener
curl -X POST http://localhost:3000/dao/listener/start
```

### Database Maintenance

```bash
# Vacuum database
psql -U postgres -d agent_guild_db -c "VACUUM ANALYZE;"

# Check table sizes
psql -U postgres -d agent_guild_db -c "SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) FROM pg_tables WHERE schemaname = 'public';"
```

## Advanced Configuration

### Custom Event Handlers

To add new event types, modify `event-listener.service.ts`:

```typescript
// Add new event watcher
this.unwatchCustomEvent = client.watchEvent({
  address: this.customAddress,
  event: parseAbiItem('event CustomEvent(...)'),
  onLogs: (logs) => this.handleCustomEvents(logs),
});

// Add handler method
private async handleCustomEvents(logs: Log[]) {
  // Process custom events
}
```

### Multiple Chain Support

For multi-chain support, create separate service instances:

```typescript
// Create chain-specific modules
@Module({
  providers: [
    { provide: 'MAINNET_LISTENER', useClass: EventListenerService },
    { provide: 'POLYGON_LISTENER', useClass: EventListenerService },
  ],
})
```

## API Endpoints

### Event Listener Management

```bash
# Get status
GET /dao/listener/status

# Start listener (requires auth)
POST /dao/listener/start

# Stop listener (requires auth)
POST /dao/listener/stop

# Re-index from block (requires auth)
POST /dao/indexer/reindex?fromBlock=19000000
```

## Testing

### Unit Tests

Run unit tests:
```bash
npm run test
```

### Integration Tests

Test event processing:
```typescript
describe('EventListenerService', () => {
  it('should process ProposalCreated events', async () => {
    // Test implementation
  });
});
```

### Manual Testing

1. Deploy test contracts on testnet
2. Create test proposals and votes
3. Verify events are synced to database
4. Check data consistency

## Support

For issues or questions:
1. Check application logs
2. Review this documentation
3. Check the EVENT_LISTENER.md for technical details
4. Open an issue on the project repository

## Next Steps

After setup:
1. Monitor the initial indexing process
2. Verify data accuracy with on-chain data
3. Set up monitoring and alerting
4. Configure backup strategies
5. Plan for scaling as event volume grows
