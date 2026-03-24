#!/bin/bash

# User 1
curl -X POST http://localhost:3001/api/auth/register -H "Content-Type: application/json" -d '{
  "email": "user1@example.com",
  "password": "password123",
  "name": "Test User 1"
}'

# User 2
curl -X POST http://localhost:3001/api/auth/register -H "Content-Type: application/json" -d '{
  "email": "user2@example.com",
  "password": "password123",
  "name": "Test User 2"
}'

# User 3
curl -X POST http://localhost:3001/api/auth/register -H "Content-Type: application/json" -d '{
  "email": "user3@example.com",
  "password": "password123",
  "name": "Test User 3"
}'
