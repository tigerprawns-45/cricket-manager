---
name: Cricket Manager
id: cricket-manager
stage: live
owner: Jason
summary: Match-day planner for the Seaforth HOWZATS U11s — the coach marks who's unavailable and it rebuilds the batting order (balls per batter scaled to how many players are available), the 20-over bowling rotation and fielding positions, alongside the season roster of captain, wicketkeepers and lollies.
links:
  live: https://tigerprawns-45.github.io/cricket-manager/
---

Replaces the season spreadsheet used to run the Seaforth HOWZATS U11s (2026/27). Today that
sheet holds the batting order (15 balls each with 8 players; 24/20/17/15/13 balls for 5–9
players), a 20-over bowling order, a field diagram for each innings half showing who stands
where, and a weekly roster of captain/wicketkeeper, second wicketkeeper, lollies and Friday
training times. The app's job is to keep all of that straight when a player drops out, so the
order, overs and field rebalance without redoing the sheet by hand.

## Roadmap

### Build
- Manage the batting order, bowling order and fielding positions
- Note when a player is unavailable and rebalance around them
- Each batter faces a set number of balls depending on how many players are available
- Show the roster for captain and lollies
- Bowling rebalance: just keep going back around the list
- Fielding positions and bowling order are linked — players rotate after every over, so field positions rotate too, with the exception of the wicket keeper
- Nominate a wicket keeper for each 10-over block; they don't rotate or bowl during that block
- Second 10-over block: just continue around the list from where the first block left off, skipping the keeper
