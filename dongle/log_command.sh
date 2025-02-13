#!/bin/bash

CONTIKI_DIR='/home/iot/Desktop/contiki-ng'
duration=$1
port=$2
logFile=$3

echo "$duration $port $logFile"

touch $logFile
echo "timeout ${duration}s rlwrap ${CONTIKI_DIR}/tools/serial-io/serialdump -b115200 ${port} > ${logFile} 2>&1"
timeout ${duration}s rlwrap ${CONTIKI_DIR}/tools/serial-io/serialdump -b115200 ${port} > ${logFile} 2>&1
