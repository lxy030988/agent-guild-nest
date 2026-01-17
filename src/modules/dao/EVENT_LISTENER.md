# DAO Event Listener Service

This document describes the blockchain event listener and indexer services for automatic DAO data synchronization.

## Overview

The event listener service provides real-time blockchain event monitoring and automatic database synchronization for DAO governance activities. It consists of two main components:

1. **IndexerService** - Historical event indexing
2. **EventListenerService** - Real-time event monitoring

## Features

### Historical Event Indexing

- Indexes all historical events from the deployment block
- Batch processes events in chunks of 10,000 blocks
- Automatically resumes from the last indexed block
- Handles large event ranges efficiently
- Retry logic with exponential backoff for RPC failures

### Real-Time Event Listening

- Monitors blockchain events in real-time using Viem's `watchEvent`
- Automatically syncs new proposals, votes, and staking events
- Updates proposal status (executed, canceled)
- Handles chain reorganizations gracefully
- Comprehensive error handling and logging

## Monitored Events

### Governor Contract Events

1. **ProposalCreated**
   - Creates new proposal records
   - Parses proposal metadata
   - Records proposal parameters (start/end blocks, etc.)

2. **VoteCast**
   - Records individual votes
   - Updates proposal vote counts
   - Tracks voter statistics

3. **ProposalExecuted**
   - Updates proposal execution status
   - Records execution transaction hash
   - Updates governance statistics

4. **ProposalCanceled**
   - Marks proposals as canceled
   - Records cancellation timestamp
   - Updates governance statistics

### Staking Contract Events

1. **Staked**
   - Creates stake records
   - Calculates unlock times
   - Tracks voting power multipliers

2. **Unstaked**
   - Marks stakes as withdrawn
   - Records withdrawal transaction
   - Updates staking statistics

## Configuration

### Environment Variables

Required environment variables (add to `.env`):

```bash
# Blockchain Configuration
CHAIN_ID=1
RPC_URL=https://eth.llamarpc.com
BLOCKCHAIN_RPC_URL=https://eth.llamarpc.com

# Contract Addresses
GOVERNOR_CONTRACT_ADDRESS=0x...
TOKEN_CONTRACT_ADDRESS=0x...
STAKING_CONTRACT_ADDRESS=0x...
TREASURY_ADDRESS=0x...
GOVERNANCE_TOKEN_ADDRESS=0x...

# Indexing Configuration
START_BLOCK=18500000  # Set to your contract deployment block
```

### Indexing Configuration

The indexer can be configured by modifying these constants in `indexer.service.ts`:

```typescript
private readonly BATCH_SIZE = 10000;  // Blocks per batch
private readonly MAX_RETRIES = 3;      // Retry attempts
private readonly RETRY_DELAY = 2000;   // Retry delay in ms
```

## Usage

### Automatic Startup

The event listener automatically starts when the application launches:

1. Historical events are indexed first (from `START_BLOCK` to current block)
2. Real-time event listening begins after indexing completes
3. All events are processed and saved to the database

### Manual Operations

You can access the services programmatically:

```typescript
import { EventListenerService } from './event-listener.service';
import { IndexerService } from './indexer.service';

// Inject services
constructor(
  private readonly eventListener: EventListenerService,
  private readonly indexer: IndexerService,
) {}

// Get listener status
const status = this.eventListener.getStatus();

// Stop listening
await this.eventListener.stopListening();

// Start listening
await this.eventListener.startListening();

// Manually re-index from a specific block
await this.indexer.reindexFromBlock(BigInt(19000000));
```

## Architecture

### Event Processing Flow

```
Blockchain Event
    ↓
Event Listener (Viem watchEvent)
    ↓
Decode Event Log
    ↓
Validate & Transform Data
    ↓
Call Appropriate Service (Proposals/Voting/Staking)
    ↓
Update Database (via Prisma)
    ↓
Update Statistics & Activity Log
```

### Indexing Flow

```
Start Indexing
    ↓
Get Last Indexed Block
    ↓
Calculate Block Ranges (batches of 10,000)
    ↓
For Each Batch:
    ├─ Fetch All Event Types in Parallel
    ├─ Process Events in Order
    ├─ Save to Database
    └─ Update Progress
    ↓
Complete Indexing
```

## Error Handling

### Retry Logic

The indexer implements retry logic for RPC failures:

- Maximum 3 retry attempts per request
- 2-second delay between retries
- Exponential backoff for rate limiting

### Error Recovery

- Failed events are logged but don't stop the indexing process
- Duplicate events are detected and skipped
- Invalid data is caught and logged for debugging

### Logging

Comprehensive logging at different levels:

- `INFO`: Startup, progress updates, completion
- `WARN`: Recoverable errors, missing data
- `ERROR`: Critical failures, unhandled exceptions
- `DEBUG`: Detailed event processing information

## Performance Optimization

### Batch Processing

Events are processed in batches to optimize performance:

- 10,000 blocks per batch (configurable)
- Parallel fetching of different event types
- Sequential processing to maintain data integrity

### Database Optimization

- Bulk inserts where possible
- Upsert operations for idempotency
- Indexed queries for fast lookups
- Efficient duplicate detection

### RPC Optimization

- Minimized RPC calls through batching
- Retry logic prevents unnecessary failures
- 500ms delay between batches to avoid rate limiting

## Monitoring

### Status Endpoint

Check the event listener status:

```typescript
GET /dao/listener/status

Response:
{
  "isListening": true,
  "contracts": {
    "governor": "0x...",
    "staking": "0x...",
    "treasury": "0x..."
  }
}
```

### Logs

Monitor logs for event processing:

```
[EventListenerService] Event listeners started successfully
[EventListenerService] ProposalCreated: ID=1, Proposer=0x...
[EventListenerService] VoteCast: Voter=0x..., ProposalId=1, Support=FOR
[IndexerService] Indexing events from block 18500000 to 19500000
[IndexerService] Processing batch: 18500000 to 18510000 (10%)
```

## Chain Reorganization Handling

The event listener handles chain reorganizations gracefully:

1. Events from reorganized blocks are automatically removed
2. New events from the canonical chain are processed
3. Database state remains consistent

## Best Practices

### Production Deployment

1. Use a dedicated RPC endpoint (Alchemy, Infura, etc.)
2. Set `START_BLOCK` to contract deployment block
3. Monitor logs for errors and performance
4. Set up alerts for listener failures
5. Consider using a separate indexing service for initial sync

### Development

1. Use testnet contracts for testing
2. Set a recent `START_BLOCK` to reduce indexing time
3. Monitor database size during development
4. Test with different block ranges

### Maintenance

1. Regularly check indexer progress
2. Monitor RPC quota usage
3. Review error logs for patterns
4. Consider re-indexing if data discrepancies occur

## Troubleshooting

### Common Issues

**Issue**: Indexing is slow
- **Solution**: Reduce `BATCH_SIZE` or use a faster RPC endpoint

**Issue**: RPC rate limiting
- **Solution**: Increase delay between batches or upgrade RPC plan

**Issue**: Missing events
- **Solution**: Re-index from a specific block using `reindexFromBlock()`

**Issue**: Duplicate events
- **Solution**: Events are automatically de-duplicated, check logs for warnings

**Issue**: Listener stopped unexpectedly
- **Solution**: Check logs for errors, restart using `startListening()`

## Future Enhancements

Potential improvements:

1. WebSocket support for lower latency
2. Multi-chain support
3. Event replay functionality
4. Real-time status dashboard
5. Configurable event filters
6. Prometheus metrics integration
7. Automatic re-org detection and recovery
8. Event archival and compression

## Testing

### Unit Tests

Test individual event handlers:

```typescript
describe('EventListenerService', () => {
  it('should handle ProposalCreated events', async () => {
    // Test implementation
  });
});
```

### Integration Tests

Test end-to-end event processing:

```typescript
describe('Event Indexing', () => {
  it('should index historical events', async () => {
    // Test implementation
  });
});
```

## Resources

- [Viem Documentation](https://viem.sh)
- [OpenZeppelin Governor](https://docs.openzeppelin.com/contracts/4.x/governance)
- [Ethereum JSON-RPC API](https://ethereum.org/en/developers/docs/apis/json-rpc/)
- [NestJS Lifecycle Events](https://docs.nestjs.com/fundamentals/lifecycle-events)
