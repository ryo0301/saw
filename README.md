# saw

My AWS CLI Wrapper

## Sample Configurations

### conf/accounts.json

```
{
  "default": {
    "profile": "default",
    "region": "ap-northeast-1"
  },
  "accounts": {
    "myawsaccount1": {
      "account_id": "000000000000",
      "account_alias": "accountalias"
    }
  }
}
```

### conf/keymap.json

```
{
  "default": {
    "alias_key": "myawsaccount1",
    "user": "ec2-user"
  },
  "keymap": {
    "myawsaccount1": {
      "ec2-user": "my.pem"
    }
  }
}
```
