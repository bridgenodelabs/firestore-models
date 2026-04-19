# Changelog

All notable changes to this project will be documented in this file.

## 0.2.0

### Added

- adapter write helpers for full domain writes and partial domain updates
- React `updateById(...)` as the preferred partial domain update path
- optional model-owned `toPartialPersisted(...)` for shallow partial conversion

### Changed

- refreshed root docs, user guide, design notes, and sample READMEs to show the preferred write lanes
- updated the web sample to use `create(...)` for full writes and `updateById(...)` for partial updates
- updated the project/task sample to emphasize model-owned conversion at the transaction boundary

### Notes

- raw persisted helpers remain available as explicit escape hatches
