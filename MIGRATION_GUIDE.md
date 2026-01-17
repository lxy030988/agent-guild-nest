# Event Listener Migration Guide

This guide is for projects that already have the DAO module and want to add the event listener functionality.

## Overview

The event listener service has been added to automatically sync blockchain events to your database. This eliminates the need for manual data synchronization and ensures your database stays up-to-date with on-chain activities.

## What's New

### New Services
- **EventListenerService**: Real-time blockchain event monitoring
- **IndexerService**: Historical event indexing and batch processing

### New Files Created
```
src/modules/dao/
├── event-listener.service.ts       # Real-time event listener
├── indexer.service.ts              # Historical event indexer
├── EVENT_LISTENER.md               # Technical documentation
├── SETUP_EVENT_LISTENER.md         # Setup guide
├── QUICK_REFERENCE.md              # Quick reference
└── EVENT_LISTENER_SUMMARY.md       # Implementation summary
```

### Modified Files
```
src/modules/dao/
├── dao.module.ts                   # Added new services
├── dao.controller.ts               # Added management endpoints
└── package.json                    # Added viem dependency

.env.dao.example                     # Added new config variables
```

## Migration Steps

### Step 1: Update Dependencies

The `viem` library has been added to `package.json`. Install it:

```bash
npm install
```

If npm install fails, manually install viem:
```bash
npm install viem@^2.21.55
```

### Step 2: Update Environment Variables

Add these new variables to your `.env` file:

```bash
# Add to existing .env file

# Event Indexing Configuration
START_BLOCK=18500000  # Set to your contract deployment block
BLOCKCHAIN_RPC_URL=https://eth.llamarpc.com  # Same as RPC_URL

# Additional Contract Addresses
TREASURY_ADDRESS=0x...  # Your treasury contract address
GOVERNANCE_TOKEN_ADDRESS=0x...  # Your governance token address
```

To find your START_BLOCK:
1. Go to Etherscan
2. Find your Governor contract deployment transaction
3. Use that block number

### Step 3: Verify Database Schema

The event listener uses existing database tables. Ensure your Prisma schema is up to date:

```bash
npx prisma generate
```

No new migrations are required - the listener uses existing tables:
- Proposal
- Vote
- Stake
- GovernanceActivity
- GovernanceStats

### Step 4: Test in Development

Start the application in development mode:

```bash
npm run start:dev
```

Watch the logs for:
```
[EventListenerService] Starting historical event indexing...
[IndexerService] Indexing events from block X to Y...
[IndexerService] Historical event indexing completed
[EventListenerService] Event listeners started successfully
```

### Step 5: Verify Data Sync

Check if data is being synced:

```bash
# Check listener status
curl http://localhost:3000/dao/listener/status

# Check if proposals are syncing
curl http://localhost:3000/dao/proposals

# Check database
psql -U postgres -d agent_guild_db -c "SELECT COUNT(*) FROM \"Proposal\";"
```

## Backward Compatibility

### No Breaking Changes

The event listener service:
- ✅ Works alongside existing API endpoints
- ✅ Uses existing database schema
- ✅ Integrates with existing services
- ✅ Doesn't modify existing functionality
- ✅ Can be disabled without breaking the app

### Existing Endpoints Still Work

All existing endpoints remain unchanged:
- `GET /dao/proposals` - Still works
- `POST /dao/proposals` - Still works for manual creation
- All voting, staking, treasury endpoints - Still work

### Optional Activation

If you don't want to use the event listener:

1. **Option A**: Don't configure environment variables
   - Listener will fail to start but app continues running

2. **Option B**: Disable in module
   ```typescript
   // dao.module.ts - Comment out these lines:
   // EventListenerService,
   // IndexerService,
   ```

3. **Option C**: Stop via API
   ```bash
   curl -X POST http://localhost:3000/dao/listener/stop
   ```

## Data Considerations

### Existing Data

If you already have proposals/votes in your database:
- ✅ Existing data won't be affected
- ✅ Duplicate detection prevents re-adding
- ⚠️ Data inconsistency might occur if manual entries differ from blockchain

### Recommendations

**Option 1**: Clean slate (recommended for new deployments)
```sql
-- Backup first!
TRUNCATE "Proposal", "Vote", "Stake", "GovernanceActivity" CASCADE;

-- Then let indexer rebuild from blockchain
```

**Option 2**: Keep existing data
- Indexer will skip duplicates
- Verify data consistency manually
- Re-index if you find issues

**Option 3**: Hybrid approach
```sql
-- Only clear data from a specific point
DELETE FROM "Proposal" WHERE "blockNumber" >= 19000000;
DELETE FROM "Vote" WHERE "blockNumber" >= 19000000;
DELETE FROM "Stake" WHERE "blockNumber" >= 19000000;

-- Set START_BLOCK to 19000000
```

## Testing Checklist

Before deploying to production:

- [ ] Environment variables are configured
- [ ] Viem dependency is installed
- [ ] Application starts without errors
- [ ] Historical indexing completes successfully
- [ ] Real-time listener is active
- [ ] New blockchain events appear in database
- [ ] Existing API endpoints still work
- [ ] Performance is acceptable
- [ ] Logs show no errors
- [ ] Database queries are fast

## Production Deployment

### Pre-Deployment

1. **Test in staging first**
   ```bash
   # Use testnet in staging
   CHAIN_ID=11155111
   RPC_URL=https://rpc.sepolia.org
   START_BLOCK=4500000
   ```

2. **Backup production database**
   ```bash
   pg_dump -U postgres agent_guild_db > backup_$(date +%Y%m%d).sql
   ```

3. **Plan for downtime**
   - Initial indexing might take 5-30 minutes
   - Or do indexing before deploying (offline)

### Deployment Options

**Option A**: Deploy and let it index (simple but causes downtime)
```bash
# 1. Deploy new code
git pull
npm install
npm run build

# 2. Restart app (indexing happens automatically)
pm2 restart agent-guild-api

# 3. Monitor logs
pm2 logs agent-guild-api
```

**Option B**: Pre-index offline (recommended for production)
```bash
# 1. Clone production database to staging
pg_dump production_db | psql staging_db

# 2. Run indexing in staging
npm run start:dev
# Wait for indexing to complete

# 3. Backup indexed database
pg_dump staging_db > indexed_backup.sql

# 4. Stop production app
pm2 stop agent-guild-api

# 5. Restore indexed database
psql production_db < indexed_backup.sql

# 6. Deploy new code and restart
git pull
npm install
npm run build
pm2 restart agent-guild-api
```

**Option C**: Blue-Green deployment (zero downtime)
```bash
# 1. Set up new environment with indexed data
# 2. Switch DNS/load balancer
# 3. Keep old environment as backup
```

### Post-Deployment

1. **Monitor for 24 hours**
   ```bash
   # Check status every hour
   */60 * * * * curl http://localhost:3000/dao/listener/status
   ```

2. **Verify data consistency**
   ```bash
   # Compare on-chain data with database
   # Check proposal counts
   # Verify vote counts
   ```

3. **Monitor resource usage**
   ```bash
   pm2 monit
   htop
   df -h  # Check disk space
   ```

## Rollback Plan

If something goes wrong:

### Quick Rollback (if you have backup)

```bash
# 1. Stop application
pm2 stop agent-guild-api

# 2. Restore database backup
psql -U postgres agent_guild_db < backup_20260112.sql

# 3. Revert code
git revert <commit-hash>
npm install
npm run build

# 4. Restart
pm2 restart agent-guild-api
```

### Disable Event Listener Only

```bash
# Stop listener via API
curl -X POST http://localhost:3000/dao/listener/stop \
  -H "Authorization: Bearer YOUR_TOKEN"

# Or comment out in code and restart
# dao.module.ts: Comment EventListenerService
```

## Monitoring

### Set Up Alerts

```bash
# Create monitoring script
cat > monitor-listener.sh << 'EOF'
#!/bin/bash
STATUS=$(curl -s http://localhost:3000/dao/listener/status | jq -r '.isListening')
if [ "$STATUS" != "true" ]; then
  # Send alert (email, Slack, PagerDuty, etc.)
  echo "Event listener is down!" | mail -s "Alert" admin@example.com

  # Auto-restart
  curl -X POST http://localhost:3000/dao/listener/start \
    -H "Authorization: Bearer YOUR_TOKEN"
fi
EOF

chmod +x monitor-listener.sh

# Add to cron
echo "*/5 * * * * /path/to/monitor-listener.sh" | crontab -
```

### Metrics to Track

1. Listener status (up/down)
2. Last indexed block
3. Event processing rate
4. API response time
5. Database size
6. Error rate

## Troubleshooting Migration Issues

### Issue: npm install fails

**Solution**:
```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules
rm -rf node_modules package-lock.json

# Reinstall
npm install

# If still failing, install viem manually
npm install viem@^2.21.55
```

### Issue: Indexing is very slow

**Solutions**:
- Set START_BLOCK to contract deployment block
- Use dedicated RPC endpoint (Alchemy, Infura)
- Reduce BATCH_SIZE in indexer.service.ts
- Consider pre-indexing offline

### Issue: Database errors during indexing

**Solutions**:
- Check database connection
- Verify Prisma schema is up to date
- Ensure database has enough disk space
- Check for foreign key constraints

### Issue: Events not appearing

**Solutions**:
- Verify contract addresses are correct
- Check START_BLOCK is not too recent
- Verify RPC endpoint is working
- Check logs for errors

## FAQ

**Q: Do I need to re-deploy my smart contracts?**
A: No, this only affects the backend. Smart contracts remain unchanged.

**Q: Will this affect my existing data?**
A: No, existing data is preserved. The indexer skips duplicates.

**Q: How long does initial indexing take?**
A: Depends on START_BLOCK and RPC provider. Usually 5-30 minutes.

**Q: Can I use this with multiple chains?**
A: Yes, but you'll need separate service instances. See EVENT_LISTENER.md for details.

**Q: What if I don't have a START_BLOCK?**
A: Use block 0, but indexing will take much longer. Better to find your deployment block.

**Q: Do I need to keep manual data entry endpoints?**
A: No, but they can be useful for testing or manual corrections.

**Q: What happens if the listener crashes?**
A: It will restart automatically with the app and resume from the last indexed block.

**Q: Can I run this in a separate service?**
A: Yes, you can deploy the indexer as a separate microservice.

## Support

If you encounter issues during migration:

1. Check logs: `pm2 logs agent-guild-api`
2. Review ERROR_LISTENER.md for technical details
3. Review SETUP_EVENT_LISTENER.md for configuration
4. Check database connection and schema
5. Verify contract addresses are correct
6. Test RPC endpoint connectivity

## Success Criteria

Your migration is successful when:

- ✅ Application starts without errors
- ✅ Historical indexing completes
- ✅ Real-time listener is active
- ✅ New events appear in database within seconds
- ✅ API endpoints return correct data
- ✅ Performance is acceptable
- ✅ No errors in logs
- ✅ Monitoring is set up

## Next Steps

After successful migration:

1. Monitor the system for 24-48 hours
2. Verify data consistency with blockchain
3. Set up automated monitoring and alerts
4. Document your specific configuration
5. Train team on new capabilities
6. Consider additional optimizations

## Conclusion

The event listener service significantly improves your DAO application by:
- Eliminating manual data entry
- Ensuring data consistency with blockchain
- Providing real-time updates
- Reducing operational overhead

The migration is designed to be seamless with no breaking changes to existing functionality.
