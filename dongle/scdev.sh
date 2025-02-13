t=$(ls /dev/ttyACM* 2>/dev/null)

if [ -z "$t" ]; then
    echo 
else
    for device in $t; do
        device_info=$(udevadm info --name=$device --query=property)
        product_Id=$(echo $device_info | grep -oP "ID_(USB_)SERIAL_SHORT=\K[^ ]*")
        echo  $product_Id,$device 
    done
fi
